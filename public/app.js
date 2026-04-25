/* ═══════════════════════════════════════════════════════
   MediCare v4.0 — app.js
   ✅ Login / per-user data (localStorage)
   ✅ Works on Vercel (no server dependency)
   ✅ PWA installable
   ✅ Mobile-crisp (no blur)
   ✅ Real alarm sound
   ═══════════════════════════════════════════════════════ */

$(function () {

  // ════════════════════════════════════════════════════
  //  AUTH — per-user localStorage
  //  Users stored as:  mc_users  = { username: {name, passHash} }
  //  Current session:  mc_session = username
  //  Per-user data:    mc_{username}_meds
  //                    mc_{username}_hist
  // ════════════════════════════════════════════════════

  var currentUser = null;

  function simpleHash(str) {
    // Simple non-crypto hash — good enough for local storage
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return h.toString(36);
  }

  function getUsers()       { try { return JSON.parse(localStorage.getItem('mc_users') || '{}'); } catch(e) { return {}; } }
  function saveUsers(u)     { localStorage.setItem('mc_users', JSON.stringify(u)); }
  function getSession()     { return localStorage.getItem('mc_session'); }
  function setSession(u)    { localStorage.setItem('mc_session', u); }
  function clearSession()   { localStorage.removeItem('mc_session'); }

  function userKey(u, type) { return 'mc_' + u + '_' + type; }
  function getMeds(u)       { try { return JSON.parse(localStorage.getItem(userKey(u,'meds')) || '[]'); } catch(e) { return []; } }
  function saveMeds(u, d)   { localStorage.setItem(userKey(u,'meds'), JSON.stringify(d)); }
  function getHist(u)       { try { return JSON.parse(localStorage.getItem(userKey(u,'hist')) || '[]'); } catch(e) { return []; } }
  function saveHist(u, d)   { localStorage.setItem(userKey(u,'hist'), JSON.stringify(d)); }

  function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

  // ── Sign Up ──────────────────────────────────────
  $('#btn-signup').on('click', function () {
    var name = $('#su-name').val().trim();
    var user = $('#su-user').val().trim().toLowerCase().replace(/\s+/g,'');
    var pass = $('#su-pass').val();
    $('#login-err').hide();

    if (!name)          { showLoginErr('Please enter your full name.'); return; }
    if (!user)          { showLoginErr('Please choose a username.'); return; }
    if (user.length < 3){ showLoginErr('Username must be at least 3 characters.'); return; }
    if (!pass || pass.length < 4) { showLoginErr('Password must be at least 4 characters.'); return; }

    var users = getUsers();
    if (users[user])    { showLoginErr('Username already taken. Try another.'); return; }

    users[user] = { name: name, passHash: simpleHash(pass) };
    saveUsers(users);
    setSession(user);
    currentUser = user;
    enterApp();
  });

  // ── Sign In ──────────────────────────────────────
  $('#btn-signin').on('click', function () {
    var user = $('#si-user').val().trim().toLowerCase();
    var pass = $('#si-pass').val();
    $('#login-err').hide();

    if (!user) { showLoginErr('Please enter your username.'); return; }
    if (!pass) { showLoginErr('Please enter your password.'); return; }

    var users = getUsers();
    if (!users[user]) { showLoginErr('Username not found. Please sign up first.'); return; }
    if (users[user].passHash !== simpleHash(pass)) { showLoginErr('Incorrect password.'); return; }

    setSession(user);
    currentUser = user;
    enterApp();
  });

  // Allow Enter key on login inputs
  $('#si-user, #si-pass').on('keydown', function(e) { if (e.which===13) $('#btn-signin').click(); });
  $('#su-name, #su-user, #su-pass').on('keydown', function(e) { if (e.which===13) $('#btn-signup').click(); });

  function showLoginErr(msg) {
    $('#login-err').text('⚠️ ' + msg).show();
  }

  // ── Login tab switch ─────────────────────────────
  $('#tab-signin').on('click', function () {
    $('#tab-signin').addClass('active'); $('#tab-signup').removeClass('active');
    $('#signin-form').show(); $('#signup-form').hide();
    $('#login-err').hide();
  });
  $('#tab-signup').on('click', function () {
    $('#tab-signup').addClass('active'); $('#tab-signin').removeClass('active');
    $('#signup-form').show(); $('#signin-form').hide();
    $('#login-err').hide();
  });

  // ── Enter app after login ────────────────────────
  function enterApp() {
    var users = getUsers();
    var displayName = users[currentUser] ? users[currentUser].name : currentUser;
    $('#header-username').text(displayName.split(' ')[0]);
    $('#settings-username').text(displayName);
    $.mobile.changePage('#page-home', { transition: 'fade' });
    renderHome();
    renderHistory();
    checkAlarms();
  }

  // ── Logout ───────────────────────────────────────
  function doLogout() {
    clearSession();
    currentUser = null;
    stopAlarm();
    $.mobile.changePage('#page-login', { transition: 'fade', reverse: true });
  }
  $('#btn-logout, #btn-logout-settings').on('click', doLogout);

  // ── Auto-login if session exists ─────────────────
  $(document).on('pageshow', '#page-login', function () {
    var sess = getSession();
    if (sess && getUsers()[sess]) {
      currentUser = sess;
      enterApp();
    }
  });

  // ════════════════════════════════════════════════
  //  ALARM ENGINE — HTML Audio (most reliable)
  // ════════════════════════════════════════════════

  // 440Hz sine wave WAV as base64 — short beep
  var BEEP_SRC = (function(){
    var sr=44100, dur=0.28, freq=880, vol=0.85;
    var n=Math.floor(sr*dur), buf=new Int16Array(n);
    for(var i=0;i<n;i++){
      var fade=i>n*.75?(n-i)/(n*.25):1;
      buf[i]=Math.round(Math.sin(2*Math.PI*freq*i/sr)*vol*fade*32767);
    }
    var hdr=new ArrayBuffer(44), v=new DataView(hdr);
    var ws=function(o,s){for(var i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i));};
    var wi=function(o,val,b){if(b===4)v.setUint32(o,val,true);else v.setUint16(o,val,true);};
    ws(0,'RIFF'); wi(4,36+n*2,4); ws(8,'WAVE'); ws(12,'fmt ');
    wi(16,16,4); wi(20,1,2); wi(22,1,2); wi(24,sr,4); wi(28,sr*2,4); wi(32,2,2); wi(34,16,2);
    ws(36,'data'); wi(40,n*2,4);
    var bytes=new Uint8Array(44+n*2);
    bytes.set(new Uint8Array(hdr));
    bytes.set(new Uint8Array(buf.buffer),44);
    var bin=''; bytes.forEach(function(b){bin+=String.fromCharCode(b);});
    return 'data:audio/wav;base64,'+btoa(bin);
  })();

  var alarmRunning=false, alarmHandle=null;
  var _pool=[];

  function getBeep(){
    for(var i=0;i<_pool.length;i++){
      if(_pool[i].paused||_pool[i].ended) return _pool[i];
    }
    var a=new Audio(BEEP_SRC); a.volume=1.0; _pool.push(a); return a;
  }

  function playBeep(){
    try{ var a=getBeep(); a.currentTime=0;
      var p=a.play(); if(p&&p.catch)p.catch(function(){});
    }catch(e){}
  }

  var _beepTimes=[0,380,760], _cycle=2200, _cycleStart=0;

  function alarmTick(){
    if(!alarmRunning)return;
    var pos=(Date.now()-_cycleStart)%_cycle;
    for(var i=0;i<_beepTimes.length;i++){
      if(Math.abs(pos-_beepTimes[i])<55){ playBeep(); break; }
    }
    alarmHandle=setTimeout(alarmTick,75);
  }

  function startAlarm(){
    if(alarmRunning)return;
    alarmRunning=true; _cycleStart=Date.now();
    alarmTick();
  }

  function stopAlarm(){
    alarmRunning=false;
    if(alarmHandle){clearTimeout(alarmHandle);alarmHandle=null;}
    _pool.forEach(function(a){try{a.pause();a.currentTime=0;}catch(e){}});
  }

  // ── Alarm popup ──────────────────────────────────
  var snoozedIds={};

  function showAlarmPopup(meds){
    var now=Date.now();
    meds=meds.filter(function(m){return !snoozedIds[m.id]||snoozedIds[m.id]<=now;});
    if(!meds.length)return;
    $('#alarm-overlay').remove();
    var names=meds.map(function(m){
      return '<div style="margin:3px 0"><b>'+m.name+'</b><br>'
        +'<span style="color:#7a8fa6;font-size:.8rem">'+m.dose+' · '+to12h(m.time)+'</span></div>';
    }).join('');
    var ids=meds.map(function(m){return m.id;}).join(',');
    $('body').append(
      '<div id="alarm-overlay">'
      +'<div style="background:#fff;border-radius:22px;padding:26px 22px;max-width:310px;'
      +'width:92%;text-align:center;animation:popIn .3s ease">'
      +'<div style="font-size:50px;animation:bellRing .5s ease infinite alternate;display:inline-block;margin-bottom:8px">🔔</div>'
      +'<div style="font-family:Syne,sans-serif;font-size:1.2rem;font-weight:800;color:#0d1f3c;margin-bottom:8px">Medicine Time!</div>'
      +'<div style="font-size:.86rem;line-height:1.7;margin-bottom:18px;padding:10px;background:#f0faf8;border-radius:10px;text-align:left">'+names+'</div>'
      +'<button id="alarm-taken-btn" data-ids="'+ids+'" style="width:100%;padding:13px;margin-bottom:8px;background:linear-gradient(135deg,#0ec4a8,#09a48c);color:#fff;border:none;border-radius:12px;font-family:Nunito,sans-serif;font-size:.95rem;font-weight:800;cursor:pointer">✅ Mark as Taken</button>'
      +'<button id="alarm-snooze-btn" data-ids="'+ids+'" style="width:100%;padding:11px;margin-bottom:6px;background:#f0faf8;color:#0d1f3c;border:none;border-radius:12px;font-family:Nunito,sans-serif;font-size:.88rem;font-weight:700;cursor:pointer">⏱ Snooze 10 min</button>'
      +'<button id="alarm-dismiss-btn" style="width:100%;padding:9px;background:transparent;color:#aaa;border:none;font-family:Nunito,sans-serif;font-size:.8rem;cursor:pointer">✕ Dismiss</button>'
      +'</div></div>'
    );
    startAlarm();
  }

  $(document).on('click','#alarm-taken-btn',function(){
    var ids=$(this).data('ids').toString().split(',');
    stopAlarm(); $('#alarm-overlay').fadeOut(200,function(){$(this).remove();});
    ids.forEach(function(id){ markTaken(id); });
    showToast('✅ Marked as taken!');
    renderHome(); renderHistory();
  });
  $(document).on('click','#alarm-snooze-btn',function(){
    var ids=$(this).data('ids').toString().split(',');
    var until=Date.now()+600000;
    ids.forEach(function(id){snoozedIds[id]=until;});
    stopAlarm(); $('#alarm-overlay').fadeOut(200,function(){$(this).remove();});
    showToast('⏱ Snoozed 10 min');
  });
  $(document).on('click','#alarm-dismiss-btn',function(){
    stopAlarm(); $('#alarm-overlay').fadeOut(200,function(){$(this).remove();});
    showToast('⚠️ Dismissed (not marked taken)');
  });

  var _lastAlarmCheck=0;
  function checkAlarms(){
    if(!currentUser)return;
    var now=Date.now();
    if(now-_lastAlarmCheck<25000)return;
    _lastAlarmCheck=now;
    var meds=getMeds(currentUser), hist=getHist(currentUser);
    var today=new Date().toDateString();
    var hh=new Date().getHours(), mm=new Date().getMinutes();
    var due=meds.filter(function(med){
      if(!med.time||!med.active)return false;
      var t=med.time.split(':').map(Number);
      var done=hist.find(function(r){return r.medId===med.id&&r.date===today;});
      return t[0]===hh&&t[1]===mm&&!done;
    });
    if(due.length)showAlarmPopup(due);
  }

  setInterval(checkAlarms,30000);

  // ════════════════════════════════════════════════
  //  TOAST & HELPERS
  // ════════════════════════════════════════════════
  function showToast(msg,isErr){
    var $t=$('#toast');
    $t.text(msg).css('background',isErr?'#ff5a5f':'').addClass('show');
    setTimeout(function(){$t.removeClass('show').css('background','');},2600);
  }

  function updateHero(){
    var h=new Date().getHours();
    $('#greet-text').text(h<12?'Good Morning ☀️':h<17?'Good Afternoon 🌤️':'Good Evening 🌙');
    $('#date-text').text(new Date().toLocaleDateString('en-IN',
      {weekday:'long',year:'numeric',month:'long',day:'numeric'}));
  }

  function to12h(t){
    if(!t||!t.includes(':'))return '--';
    var p=t.split(':'),h=parseInt(p[0],10),m=p[1],s=h>=12?'PM':'AM';
    h=h%12||12; return h+':'+m+' '+s;
  }

  function parseTypedTime(raw){
    raw=(raw||'').trim().toUpperCase();
    if(!raw)return null;
    raw=raw.replace(/[.h]/g,':');
    var isPM=raw.indexOf('PM')!==-1, isAM=raw.indexOf('AM')!==-1;
    raw=raw.replace(/AM|PM/g,'').trim();
    var h,m;
    if(raw.indexOf(':')!==-1){var p=raw.split(':');h=parseInt(p[0],10);m=parseInt(p[1]||'0',10);}
    else if(raw.length<=2){h=parseInt(raw,10);m=0;}
    else if(raw.length===3){h=parseInt(raw[0],10);m=parseInt(raw.slice(1),10);}
    else if(raw.length===4){h=parseInt(raw.slice(0,2),10);m=parseInt(raw.slice(2),10);}
    else return null;
    if(isNaN(h)||isNaN(m)||m<0||m>59)return null;
    if(isAM||isPM){if(h<1||h>12)return null;if(isAM&&h===12)h=0;if(isPM&&h!==12)h+=12;}
    else{if(h<0||h>23)return null;}
    return (h<10?'0'+h:''+h)+':'+(m<10?'0'+m:''+m);
  }

  var iconColors=['icon-teal','icon-blue','icon-pink','icon-amber'];
  function iconClass(i){return iconColors[i%iconColors.length];}

  function getStatus(med,hist,today){
    var rec=hist.find(function(r){return r.medId===med.id&&r.date===today;});
    if(rec)return rec.status;
    if(!med.time)return 'upcoming';
    var p=med.time.split(':').map(Number),due=new Date();
    due.setHours(p[0],p[1],0,0);
    return new Date()>due?'missed':'upcoming';
  }

  function medCardHTML(med,idx,status){
    var s=status||'upcoming';
    var dotC=s==='taken'?'dot-taken':s==='missed'?'dot-missed':'dot-upcoming';
    var takenBtn=s!=='taken'
      ?'<button class="btn-taken" data-id="'+med.id+'" style="display:block;margin-top:5px;background:var(--teal);color:#fff;border:none;border-radius:8px;padding:4px 10px;font-size:.68rem;font-weight:800;cursor:pointer;font-family:Nunito,sans-serif">✓ Taken</button>'
      :'<div style="text-align:center;margin-top:5px;font-size:.68rem;font-weight:800;color:var(--teal)">✓ Done</div>';
    var delBtn='<button class="btn-del" data-id="'+med.id+'" style="display:block;margin-top:3px;background:#fff0f0;color:var(--danger);border:none;border-radius:8px;padding:3px 10px;font-size:.62rem;font-weight:800;cursor:pointer;font-family:Nunito,sans-serif">✕</button>';
    return '<div class="med-card">'
      +'<div class="status-dot '+dotC+'"></div>'
      +'<div class="med-icon '+iconClass(idx)+'">'+med.type+'</div>'
      +'<div class="med-info"><div class="med-name">'+med.name+'</div>'
      +'<div class="med-meta">'+med.dose+(med.notes?' · '+med.notes:'')+'</div></div>'
      +'<div><div class="med-time">'+to12h(med.time)+'</div>'+takenBtn+delBtn+'</div>'
      +'</div>';
  }

  // ════════════════════════════════════════════════
  //  HOME
  // ════════════════════════════════════════════════
  function renderHome(){
    if(!currentUser)return;
    updateHero();
    var meds=getMeds(currentUser), hist=getHist(currentUser);
    var today=new Date().toDateString();
    var todayISO=new Date().toISOString().split('T')[0];
    var dow=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()];

    var todayMeds=meds.filter(function(m){
      if(!m.active)return false;
      if(m.startDate&&todayISO<m.startDate)return false;
      if(m.endDate&&todayISO>m.endDate)return false;
      return true;
    });

    var taken=0,missed=0,upcoming=0;
    var html='';
    todayMeds.forEach(function(med,idx){
      var s=getStatus(med,hist,today);
      if(s==='taken')taken++;
      else if(s==='missed')missed++;
      else upcoming++;
      html+=medCardHTML(med,idx,s);
    });

    $('#count-total').text(todayMeds.length);
    $('#count-taken').text(taken);
    $('#count-missed').text(missed);
    $('#count-upcoming').text(upcoming);

    if(!todayMeds.length){
      $('#med-list-container').html('<div class="empty-state"><div class="emoji">🌿</div><p>No medicines today.<br>Tap <strong>Add</strong> to get started.</p></div>');
    } else {
      $('#med-list-container').html(html);
    }
  }

  function markTaken(id){
    if(!currentUser)return;
    var hist=getHist(currentUser);
    var today=new Date().toDateString();
    var todayISO=new Date().toISOString().split('T')[0];
    if(hist.find(function(r){return r.medId===id&&r.date===today&&r.status==='taken';})) return;
    hist.push({
      id:genId(), medId:id, date:today, dateISO:todayISO,
      time:new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}),
      status:'taken', loggedAt:new Date().toISOString()
    });
    saveHist(currentUser,hist);
  }

  $(document).on('click','.btn-taken',function(e){
    e.stopPropagation();
    var id=$(this).data('id');
    var hist=getHist(currentUser);
    var today=new Date().toDateString();
    if(hist.find(function(r){return r.medId===id&&r.date===today&&r.status==='taken';})){
      showToast('ℹ️ Already marked today.'); return;
    }
    markTaken(id);
    showToast('✅ Marked as taken!');
    renderHome(); renderHistory(); renderCalendar();
  });

  $(document).on('click','.btn-del',function(e){
    e.stopPropagation();
    if(!confirm('Delete this medicine?'))return;
    var id=$(this).data('id');
    var meds=getMeds(currentUser).filter(function(m){return m.id!==id;});
    saveMeds(currentUser,meds);
    showToast('🗑️ Deleted.');
    renderHome(); renderHistory(); renderCalendar();
  });

  // ════════════════════════════════════════════════
  //  ADD MEDICINE
  // ════════════════════════════════════════════════
  function setDefaultDates(){
    if(!$('#inp-start').val()) $('#inp-start').val(new Date().toISOString().split('T')[0]);
  }

  function showFormError(msg){
    $('#form-error').text('⚠️ '+msg).show();
    $('html,body').animate({scrollTop:0},200);
  }

  $('#btn-save-med').on('click',function(){
    $('#form-error').hide();
    var name=$('#inp-name').val().trim();
    var dose=$('#inp-dose').val().trim();
    var rawTime=$('#inp-time').val().trim();
    var time24=parseTypedTime(rawTime);
    var type=$('#inp-type').val();
    var start=$('#inp-start').val();
    var end=$('#inp-end').val();
    var notes=$('#inp-notes').val().trim();

    if(!name){showFormError('Please enter medicine name.');return;}
    if(!dose){showFormError('Please enter dosage.');return;}
    if(!rawTime){showFormError('Please enter a reminder time (e.g. 8:30 AM).');return;}
    if(!time24){showFormError('Invalid time. Try: 8:30 AM, 14:00, 8.30 pm');return;}

    var meds=getMeds(currentUser);
    meds.push({
      id:genId(), name:name, dose:dose, time:time24,
      type:type, notes:notes,
      startDate:start||new Date().toISOString().split('T')[0],
      endDate:end||'',
      active:true, createdAt:new Date().toISOString()
    });
    saveMeds(currentUser,meds);
    $('#inp-name,#inp-dose,#inp-time,#inp-notes,#inp-end').val('');
    showToast('💊 Medicine added!');
    renderHome(); renderCalendar();
    $.mobile.changePage('#page-home',{transition:'slidedown'});
  });

  // ════════════════════════════════════════════════
  //  CALENDAR
  // ════════════════════════════════════════════════
  var calYear=new Date().getFullYear(), calMonth=new Date().getMonth()+1;
  var MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];

  function renderCalendar(){
    if(!currentUser)return;
    var meds=getMeds(currentUser), hist=getHist(currentUser);
    var label=MONTHS[calMonth-1]+' '+calYear;
    $('#cal-month-title').text(label); $('#cal-nav-label').text(label);

    var firstDay=new Date(calYear,calMonth-1,1).getDay();
    var daysInMon=new Date(calYear,calMonth,0).getDate();
    var todayISO=new Date().toISOString().split('T')[0];
    var html='';

    for(var i=0;i<firstDay;i++) html+='<div class="cal-cell cal-empty"></div>';

    for(var d=1;d<=daysInMon;d++){
      var mm=calMonth<10?'0'+calMonth:''+calMonth;
      var dd=d<10?'0'+d:''+d;
      var dateS=calYear+'-'+mm+'-'+dd;
      var scheduled=meds.filter(function(m){
        if(!m.active)return false;
        if(m.startDate&&dateS<m.startDate)return false;
        if(m.endDate&&dateS>m.endDate)return false;
        return true;
      });
      var takenN=scheduled.filter(function(m){return hist.find(function(r){return r.medId===m.id&&r.dateISO===dateS&&r.status==='taken';});}).length;
      var missedN=scheduled.filter(function(m){
        var r=hist.find(function(r){return r.medId===m.id&&r.dateISO===dateS;});
        return r?r.status==='missed':dateS<todayISO;
      }).length;
      var upcomingN=scheduled.length-takenN-missedN;
      var isToday=dateS===todayISO, isPast=dateS<todayISO;
      var dots='';
      if(takenN>0)  dots+='<span class="cal-dot" style="background:var(--teal)"></span>';
      if(missedN>0) dots+='<span class="cal-dot" style="background:var(--danger)"></span>';
      if(upcomingN>0)dots+='<span class="cal-dot" style="background:var(--warn)"></span>';
      html+='<div class="cal-cell'+(isToday?' cal-today':'')+(isPast&&!isToday?' cal-past':'')+(scheduled.length?' cal-has-med':'')+'" data-date="'+dateS+'">'
        +'<span class="cal-num">'+d+'</span>'
        +(dots?'<div class="cal-dots">'+dots+'</div>':'')+'</div>';
    }
    $('#cal-grid').html(html);
  }

  $(document).on('click','.cal-cell[data-date]',function(){
    var date=$(this).data('date');
    $('.cal-cell').removeClass('cal-selected'); $(this).addClass('cal-selected');
    $('#cal-day-label').show();
    $('#cal-selected-date').text(new Date(date+'T12:00:00').toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'}));
    var meds=getMeds(currentUser), hist=getHist(currentUser);
    var today=new Date().toDateString();
    var todayISO=new Date().toISOString().split('T')[0];
    var dayMeds=meds.filter(function(m){
      if(!m.active)return false;
      if(m.startDate&&date<m.startDate)return false;
      if(m.endDate&&date>m.endDate)return false;
      return true;
    }).map(function(m){
      var rec=hist.find(function(r){return r.medId===m.id&&r.dateISO===date;});
      return Object.assign({},m,{status:rec?rec.status:(date<todayISO?'missed':'upcoming')});
    });
    if(!dayMeds.length){
      $('#cal-day-detail').html('<div class="empty-state" style="padding:20px"><div class="emoji">🗓️</div><p>No medicines this day.</p></div>');
      return;
    }
    var html=''; dayMeds.forEach(function(m,i){html+=medCardHTML(m,i,m.status);});
    $('#cal-day-detail').html(html);
  });

  $('#cal-prev').on('click',function(){
    calMonth--; if(calMonth<1){calMonth=12;calYear--;}
    renderCalendar(); $('#cal-day-label').hide(); $('#cal-day-detail').html('');
  });
  $('#cal-next').on('click',function(){
    calMonth++; if(calMonth>12){calMonth=1;calYear++;}
    renderCalendar(); $('#cal-day-label').hide(); $('#cal-day-detail').html('');
  });

  // ════════════════════════════════════════════════
  //  HISTORY
  // ════════════════════════════════════════════════
  function renderHistory(){
    if(!currentUser)return;
    var hist=getHist(currentUser).slice().reverse().slice(0,60);
    var meds=getMeds(currentUser);
    if(!hist.length){
      $('#history-container').html('<div class="empty-state"><div class="emoji">📭</div><p>No history yet.</p></div>');
      return;
    }
    var html='';
    hist.forEach(function(rec){
      var med=meds.find(function(m){return m.id===rec.medId;});
      var name=med?med.name:'(deleted)';
      var dotC=rec.status==='taken'?'var(--teal)':'var(--danger)';
      var badgeC=rec.status==='taken'?'badge-taken':'badge-missed';
      html+='<div class="history-row">'
        +'<div class="history-dot" style="background:'+dotC+'"></div>'
        +'<div class="history-info"><div class="history-name">'+name+'</div>'
        +'<div class="history-date">'+rec.date+' at '+(rec.time||'--')+'</div></div>'
        +'<div class="history-badge '+badgeC+'">'+rec.status+'</div></div>';
    });
    $('#history-container').html(html);
  }

  // ════════════════════════════════════════════════
  //  SETTINGS
  // ════════════════════════════════════════════════
  $(document).on('click','.toggle',function(){$(this).toggleClass('on');});

  $('#btn-test-alarm').off('click').on('click',function(){
    var $btn=$(this);
    if(alarmRunning){ stopAlarm(); $btn.text('🔔 Test Alarm Sound'); showToast('⏹ Stopped.'); }
    else { startAlarm(); $btn.text('⏹ Stop Alarm'); showToast('🔔 Alarm playing…');
      setTimeout(function(){stopAlarm();$btn.text('🔔 Test Alarm Sound');},6000); }
  });

  $('#btn-clear-all').on('click',function(){
    if(!confirm('Remove ALL your medicines and history?'))return;
    saveMeds(currentUser,[]); saveHist(currentUser,[]);
    showToast('🗑️ Cleared.'); renderHome(); renderHistory(); renderCalendar();
  });
  $('#btn-clear-hist').on('click',function(){
    if(!confirm('Clear your history log?'))return;
    saveHist(currentUser,[]);
    showToast('🗑️ History cleared.'); renderHistory(); renderCalendar();
  });

  // ════════════════════════════════════════════════
  //  PWA INSTALL
  // ════════════════════════════════════════════════
  var deferredInstall=null;

  window.addEventListener('beforeinstallprompt',function(e){
    e.preventDefault(); deferredInstall=e;
    setTimeout(function(){ $('#install-banner').addClass('show'); },3000);
  });

  function doInstall(){
    if(!deferredInstall)return;
    deferredInstall.prompt();
    deferredInstall.userChoice.then(function(r){
      if(r.outcome==='accepted') showToast('✅ App installed!');
      deferredInstall=null; $('#install-banner').removeClass('show');
    });
  }

  $('#btn-install-banner,#btn-install-app').on('click',doInstall);
  $('#btn-install-close').on('click',function(){ $('#install-banner').removeClass('show'); });

  window.addEventListener('appinstalled',function(){ showToast('✅ MediCare installed!'); });

  // ════════════════════════════════════════════════
  //  PAGE HOOKS & INIT
  // ════════════════════════════════════════════════
  $(document).on('pageshow','#page-home',     function(){if(currentUser){renderHome();checkAlarms();}});
  $(document).on('pageshow','#page-add',      setDefaultDates);
  $(document).on('pageshow','#page-calendar', function(){if(currentUser)renderCalendar();});
  $(document).on('pageshow','#page-history',  function(){if(currentUser)renderHistory();});
  $(document).on('pageshow','#page-settings', function(){
    if(currentUser){
      var u=getUsers()[currentUser];
      $('#settings-username').text(u?u.name:currentUser);
    }
  });

  // Hide server banner — Vercel has no backend server to ping
  $('#server-banner').hide();

  // Refresh every minute
  setInterval(function(){if(currentUser)renderHome();},60000);
  setInterval(checkAlarms,30000);

  if('Notification' in window&&Notification.permission==='default') Notification.requestPermission();

});
