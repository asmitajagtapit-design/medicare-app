// ═══════════════════════════════════════════════════════════
//  MediCare  —  server.js   v3.0  (Fixed + Calendar Support)
// ═══════════════════════════════════════════════════════════

const express    = require('express');
const cors       = require('cors');
const bodyParser = require('body-parser');
const cron       = require('node-cron');
const path       = require('path');
const fs         = require('fs-extra');
const { v4: uuidv4 } = require('uuid');

const app  = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR   = path.join(__dirname, 'data');
const DATA_FILE  = path.join(DATA_DIR, 'medicines.json');
const HIST_FILE  = path.join(DATA_DIR, 'history.json');
const SCHED_FILE = path.join(DATA_DIR, 'schedules.json');

fs.ensureDirSync(DATA_DIR);
if (!fs.existsSync(DATA_FILE))  fs.writeJsonSync(DATA_FILE,  [], { spaces: 2 });
if (!fs.existsSync(HIST_FILE))  fs.writeJsonSync(HIST_FILE,  [], { spaces: 2 });
if (!fs.existsSync(SCHED_FILE)) fs.writeJsonSync(SCHED_FILE, [], { spaces: 2 });

function safeRead(file) {
  try { const r = fs.readFileSync(file,'utf8').trim(); return r ? JSON.parse(r) : []; }
  catch(e) { fs.writeJsonSync(file,[]); return []; }
}
const readMeds  = () => safeRead(DATA_FILE);
const writeMeds = d  => fs.writeJsonSync(DATA_FILE,  d, {spaces:2});
const readHist  = () => safeRead(HIST_FILE);
const writeHist = d  => fs.writeJsonSync(HIST_FILE,  d, {spaces:2});

app.use(cors({ origin: '*' }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/ping', (req, res) => {
  res.json({ ok: true, message: 'MediCare server is running!' });
});

app.get('/api/medicines', (req, res) => res.json(readMeds()));

app.post('/api/medicines', (req, res) => {
  const { name, dose, time, freq, type, notes, startDate, endDate, days } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name required.' });
  if (!dose || !dose.trim()) return res.status(400).json({ error: 'Dose required.' });
  const med = {
    id: uuidv4(), name: name.trim(), dose: dose.trim(),
    time: time||'', freq: freq||'Daily', type: type||'💊',
    notes: notes||'',
    startDate: startDate || new Date().toISOString().split('T')[0],
    endDate: endDate||'',
    days: days || ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
    active: true, createdAt: new Date().toISOString()
  };
  const meds = readMeds(); meds.push(med); writeMeds(meds);
  console.log(`[+] ${med.name} at ${med.time}`);
  res.status(201).json(med);
});

app.put('/api/medicines/:id', (req, res) => {
  const meds = readMeds();
  const idx  = meds.findIndex(m => m.id === req.params.id);
  if (idx===-1) return res.status(404).json({ error: 'Not found.' });
  meds[idx] = { ...meds[idx], ...req.body, id: meds[idx].id };
  writeMeds(meds); res.json(meds[idx]);
});

app.delete('/api/medicines/:id', (req, res) => {
  const meds = readMeds();
  const upd  = meds.filter(m => m.id !== req.params.id);
  if (upd.length === meds.length) return res.status(404).json({ error: 'Not found.' });
  writeMeds(upd); res.json({ success: true });
});

app.delete('/api/medicines', (req, res) => {
  writeMeds([]); writeHist([]); res.json({ success: true });
});

app.get('/api/history', (req, res) => res.json(readHist()));

app.post('/api/history', (req, res) => {
  const { medId, status } = req.body;
  if (!medId || !status) return res.status(400).json({ error: 'medId+status required.' });
  const hist  = readHist();
  const today = new Date().toDateString();
  const exists = hist.find(r => r.medId===medId && r.date===today && r.status==='taken');
  if (exists) return res.status(409).json({ error: 'Already taken today.' });
  const rec = {
    id: uuidv4(), medId, date: today,
    dateISO: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}),
    status, loggedAt: new Date().toISOString()
  };
  hist.push(rec); writeHist(hist); res.status(201).json(rec);
});

app.delete('/api/history', (req, res) => { writeHist([]); res.json({ success: true }); });

// Calendar: medicines for a specific date
app.get('/api/calendar/:date', (req, res) => {
  const date = req.params.date;
  const meds = readMeds(); const hist = readHist();
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const dow = dayNames[new Date(date+'T12:00:00').getDay()];
  const result = meds.filter(med => {
    if (!med.active) return false;
    if (med.startDate && date < med.startDate) return false;
    if (med.endDate   && date > med.endDate)   return false;
    if (med.days && med.days.length && !med.days.includes(dow)) return false;
    return true;
  }).map(med => {
    const rec = hist.find(r => r.medId===med.id && r.dateISO===date);
    return { ...med, status: rec ? rec.status : (date < new Date().toISOString().split('T')[0] ? 'missed' : 'upcoming') };
  });
  res.json({ date, day: dow, medicines: result });
});

// Calendar: month overview
app.get('/api/calendar/month/:year/:month', (req, res) => {
  const year = parseInt(req.params.year);
  const month = parseInt(req.params.month) - 1;
  const meds = readMeds(); const hist = readHist();
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const todayISO = new Date().toISOString().split('T')[0];
  const overview = {};
  for (let d=1; d<=daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    const dateStr = dateObj.toISOString().split('T')[0];
    const dow = dayNames[dateObj.getDay()];
    const scheduled = meds.filter(med => {
      if (!med.active) return false;
      if (med.startDate && dateStr < med.startDate) return false;
      if (med.endDate   && dateStr > med.endDate)   return false;
      if (med.days && med.days.length && !med.days.includes(dow)) return false;
      return true;
    });
    if (scheduled.length > 0) {
      const taken  = scheduled.filter(m => hist.find(r => r.medId===m.id && r.dateISO===dateStr && r.status==='taken')).length;
      const missed = scheduled.filter(m => {
        const rec = hist.find(r => r.medId===m.id && r.dateISO===dateStr);
        return rec ? rec.status==='missed' : dateStr < todayISO;
      }).length;
      overview[dateStr] = { total: scheduled.length, taken, missed, upcoming: scheduled.length - taken - missed };
    }
  }
  res.json({ year, month: month+1, overview });
});

// Status today
app.get('/api/status', (req, res) => {
  const meds = readMeds(); const hist = readHist();
  const today = new Date().toDateString();
  const todayISO = new Date().toISOString().split('T')[0];
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const dow = dayNames[new Date().getDay()];
  const now = new Date();
  const todayMeds = meds.filter(med => {
    if (!med.active) return false;
    if (med.startDate && todayISO < med.startDate) return false;
    if (med.endDate   && todayISO > med.endDate)   return false;
    if (med.days && med.days.length && !med.days.includes(dow)) return false;
    return true;
  });
  const summary = todayMeds.map(med => {
    const rec = hist.find(r => r.medId===med.id && r.date===today);
    let status = 'upcoming';
    if (rec) { status = rec.status; }
    else if (med.time) {
      const [h,m] = med.time.split(':').map(Number);
      const due = new Date(); due.setHours(h,m,0,0);
      if (now > due) status = 'missed';
    }
    return { ...med, status };
  });
  res.json({
    total: summary.length, taken: summary.filter(m=>m.status==='taken').length,
    missed: summary.filter(m=>m.status==='missed').length,
    upcoming: summary.filter(m=>m.status==='upcoming').length,
    medicines: summary
  });
});

app.get('/api/alarms/due', (req, res) => {
  const meds=readMeds(), hist=readHist(), now=new Date();
  const today=now.toDateString(), todayISO=now.toISOString().split('T')[0];
  const hh=now.getHours(), mm=now.getMinutes();
  const due = meds.filter(med => {
    if (!med.time || !med.active) return false;
    if (med.endDate && todayISO > med.endDate) return false;
    const [mh,mmin] = med.time.split(':').map(Number);
    return mh===hh && mmin===mm && !hist.find(r=>r.medId===med.id && r.date===today);
  });
  res.json(due);
});

cron.schedule('* * * * *', () => {
  const meds=readMeds(), hist=readHist(), now=new Date();
  const today=now.toDateString(), hh=now.getHours(), mm=now.getMinutes();
  meds.forEach(med => {
    if (!med.time || !med.active) return;
    const [mh,mmin] = med.time.split(':').map(Number);
    if (mh===hh && mmin===mm && !hist.find(r=>r.medId===med.id && r.date===today))
      console.log(`🔔 ALARM: ${med.name} | ${med.dose} | ${med.time}`);
  });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname,'public','index.html')));

app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════╗');
  console.log(`║  💊 MediCare running on port ${PORT}     ║`);
  console.log(`║  Open: http://localhost:${PORT}          ║`);
  console.log('╚══════════════════════════════════════╝\n');
});
