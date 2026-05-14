import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(cors({ origin: [FRONTEND_URL, 'http://localhost:5173', 'http://localhost:4173'] }));
app.use(express.json({ limit: '50mb' }));

// ── Mongoose Schemas ──────────────────────────────────────────
const transactionSchema = new mongoose.Schema({
  reconciliationId: { type: String, required: true, index: true },
  id: String,
  sourceId: String,
  sourceName: String,
  receipt: String,
  date: Date,
  narration: String,
  category: String,
  customCategory: String,
  paidIn: Number,
  withdrawn: Number,
  balance: Number,
  reconciled: { type: Boolean, default: false },
}, { timestamps: true });

const reconciliationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  sources: [String],
  transactionCount: Number,
  totalIn: Number,
  totalOut: Number,
  reconciledAt: Date,
  status: { type: String, enum: ['draft', 'reconciled'], default: 'draft' },
}, { timestamps: true });

const Transaction = mongoose.model('Transaction', transactionSchema);
const Reconciliation = mongoose.model('Reconciliation', reconciliationSchema);

// ── Connect MongoDB ───────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ── Routes ───────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

// Save reconciliation + transactions
app.post('/api/reconciliations', async (req, res) => {
  try {
    const { name, description, transactions } = req.body;
    if (!name || !transactions?.length) {
      return res.status(400).json({ error: 'name and transactions are required' });
    }

    const totalIn = transactions.reduce((s, t) => s + (t.paidIn || 0), 0);
    const totalOut = transactions.reduce((s, t) => s + (t.withdrawn || 0), 0);
    const sources = [...new Set(transactions.map(t => t.sourceName).filter(Boolean))];

    const rec = await Reconciliation.create({
      name,
      description,
      sources,
      transactionCount: transactions.length,
      totalIn,
      totalOut,
      reconciledAt: new Date(),
      status: 'reconciled',
    });

    // Bulk insert transactions
    const docs = transactions.map(t => ({ ...t, reconciliationId: rec._id.toString() }));
    await Transaction.insertMany(docs, { ordered: false });

    res.json({ success: true, reconciliationId: rec._id, transactionCount: docs.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// List all reconciliations
app.get('/api/reconciliations', async (req, res) => {
  try {
    const recs = await Reconciliation.find().sort({ createdAt: -1 }).lean();
    res.json(recs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single reconciliation with transactions
app.get('/api/reconciliations/:id', async (req, res) => {
  try {
    const rec = await Reconciliation.findById(req.params.id).lean();
    if (!rec) return res.status(404).json({ error: 'Not found' });
    const transactions = await Transaction.find({ reconciliationId: req.params.id }).lean();
    res.json({ ...rec, transactions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete reconciliation
app.delete('/api/reconciliations/:id', async (req, res) => {
  try {
    await Transaction.deleteMany({ reconciliationId: req.params.id });
    await Reconciliation.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 FinTrack server running on http://localhost:${PORT}`);
});
