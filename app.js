
(()=>{'use strict';const APP_VERSION='1.0';const $=id=>document.getElementById(id),dateISO=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,dateObj=s=>new Date(s+'T12:00:00'),addDays=(s,n)=>{let d=dateObj(s);d.setDate(d.getDate()+n);return dateISO(d)},round=n=>Math.round(n*100)/100,fmt=n=>`${Number(round(n)).toLocaleString('de-AT',{maximumFractionDigits:2})}`,formatDate=s=>dateObj(s).toLocaleDateString('de-AT'),weekend=s=>[0,6].includes(dateObj(s).getDay());let today=new Date(),todayStr=dateISO(today);const defaultData={startDate:todayStr,initialVacation:0,initialTime:0,defaultBreak:18,annualVacation:25,theme:'dark',workplaces:[],shifts:{},weekWorkplaces:{},shiftDays:{},customShifts:[],entries:{},planned:[],credits:[]};let data,primaryWasPresent=false,primaryLoadFailed=false;try{const stored=localStorage.getItem('arbeitszeit-v3');primaryWasPresent=stored!==null;data={...defaultData,...JSON.parse(stored||'{}')}}catch{primaryLoadFailed=true;data={...defaultData}};data.entries=data.entries||{};data.planned=data.planned||[];data.credits=data.credits||[];data.shifts=data.shifts||{};data.shiftDays=data.shiftDays||{};data.customShifts=Array.isArray(data.customShifts)?data.customShifts:[];data.workplaces=data.workplaces||[];data.weekWorkplaces=data.weekWorkplaces||{};if(data.designVersion!=='teal-design-2'){data.theme='dark';data.designVersion='teal-design-2';if(!primaryLoadFailed)persistAppData(JSON.stringify(data));}let selected=null,calendarSelection=new Set(),calendarMulti=false,calendarDrag=null,suppressCalendarClick=false,month=new Date(today.getFullYear(),today.getMonth(),1),editing=null,entryTimesTouched=false,entryWorkplaceTouched=false;function save(){realizePastVacation();persistAppData(JSON.stringify(data));render()}
// Vacation calendar: statutory Austrian holidays plus the user's free days.
// The extra free days do not change the separate overtime premium rules.
function vacationHolidayName(date) {
 const extra = {'12-24':'Heiliger Abend', '12-31':'Silvester'};
 return TimeEngine.holidayName(date) || extra[date.slice(5)] || '';
}
function vacationWorkday(date) { return !weekend(date) && !vacationHolidayName(date); }
function realizePastVacation() {
 let changed = false;
 data.planned = data.planned.filter(date => {
  if (date > todayStr || !vacationWorkday(date)) return true;
  const entry = data.entries[date];
  if (entry && entry.type !== 'TU') return true;
  if (!entry) data.entries[date] = {type:'TU'};
  changed = true;
  return false;
 });
 return changed;
}
function enterVacationDays(dates) {
 let recorded=0, planned=0, existing=0, holidays=0, weekends=0, conflicts=[];
 for (const date of dates) {
  if (vacationHolidayName(date)) { holidays++; continue; }
  if (weekend(date)) { weekends++; continue; }
  const entry = data.entries[date];
  if (entry) { if (entry.type === 'TU') existing++; else conflicts.push(date); continue; }
  if (date <= todayStr) {
   data.entries[date] = {type:'TU'};
   data.planned = data.planned.filter(d => d !== date);
   recorded++;
  } else if (!data.planned.includes(date)) { data.planned.push(date); planned++; }
  else existing++;
 }
 save();
 const parts=[];
 if (recorded) parts.push(recorded+' Urlaubstage als TU erfasst');
 if (planned) parts.push(planned+' Urlaubstage eingeplant');
 if (holidays) parts.push(holidays+' Feiertage bzw. arbeitsfreie Tage ausgenommen');
 if (weekends) parts.push(weekends+' Wochenendtage ausgenommen');
 if (existing) parts.push(existing+' Tage bereits vorhanden');
 if (conflicts.length) parts.push(conflicts.length+' Tage mit bestehenden Einträgen übersprungen: '+conflicts.map(formatDate).join(', '));
 $('planInfo').innerHTML='<div class="notice '+(conflicts.length?'warning':'')+'">'+(parts.join('. ')||'Keine zusätzlichen Urlaubstage im ausgewählten Zeitraum')+'.</div>';
}
function calendarDates() { return [...calendarSelection].sort(); }
function selectableCalendarDay(date) { return vacationWorkday(date) || data.planned.includes(date); }
function renderCalendarSelection() {
 const dates=calendarDates();
 const fresh=dates.filter(d=>vacationWorkday(d)&&!data.entries[d]&&!data.planned.includes(d));
 const planned=dates.filter(d=>data.planned.includes(d));
 const booked=dates.filter(d=>!!data.entries[d]);
 $('calendarMulti').setAttribute('aria-pressed', String(calendarMulti));
 $('calendarMulti').textContent=calendarMulti?'Mehrfachauswahl aktiv':'Mehrere Tage auswählen';
 $('calendarSelectionHelp').textContent=calendarMulti?'Tippe Tage an, um sie aus- oder abzuwählen. Am PC kannst du mit gedrückter Maustaste über mehrere Tage ziehen.':'Tippe auf einen Tag. Für mehrere Tage aktiviere die Mehrfachauswahl oder wähle einen Zeitraum.';
 $('calendarSelectionSummary').textContent=dates.length?dates.length+' Tage ausgewählt · '+fresh.length+' neu planbar · '+planned.length+' bereits geplant · '+booked.length+' bereits gebucht':'Keine Tage ausgewählt. Die Auswahl wird erst mit „Auswahl übernehmen“ gespeichert.';
 $('clearCalendarSelection').disabled=dates.length===0;
 $('planSelected').textContent='Auswahl übernehmen';
 $('planSelected').disabled=fresh.length===0;
 $('removeSelected').textContent='Planungen entfernen';
 $('removeSelected').disabled=planned.length===0;
 for(const day of $('calendar').querySelectorAll('[data-day]')) {
  const active=calendarSelection.has(day.dataset.day);
  day.classList.toggle('selected',active);
  day.setAttribute('aria-pressed',String(active));
 }
}
function clearCalendarSelection() {
 calendarSelection.clear(); selected=null; calendarDrag=null;
 renderCalendar();
}
function toggleCalendarMulti() {
 calendarMulti=!calendarMulti;
 if(!calendarMulti&&calendarSelection.size>1) {
  const keep=calendarSelection.has(selected)?selected:calendarDates().at(-1);
  calendarSelection=new Set(keep?[keep]:[]); selected=keep||null;
 }
 renderCalendar();
}
function clickCalendarDay(event) {
 if(suppressCalendarClick) { suppressCalendarClick=false; return; }
 const button=event.target.closest('[data-day]');
 if(!button) return;
 const date=button.dataset.day; selected=date;
 if(!calendarMulti) calendarSelection.clear();
 if(selectableCalendarDay(date)) {
  if(calendarMulti&&calendarSelection.has(date)) calendarSelection.delete(date);
  else calendarSelection.add(date);
 }
 renderCalendar();
}
function selectCalendarRange() {
 const from=$('planFrom').value,to=$('planTo').value;
 const message=text=>{ $('planInfo').textContent=text; };
 if(!backupDate(from)||!backupDate(to)||to<from) { message('Bitte einen gültigen Zeitraum wählen.'); return; }
 const weekdays=new Set([...document.querySelectorAll('[data-plan-weekday]:checked')].map(input=>Number(input.value)));
 if(!weekdays.size) { message('Bitte mindestens einen Wochentag auswählen.'); return; }
 const dates=[]; let count=0,excluded=0;
 for(let date=from;date<=to;date=addDays(date,1)) {
  if(++count>370) { message('Bitte einen Zeitraum von maximal 370 Tagen auswählen.'); return; }
  if(vacationWorkday(date)&&weekdays.has(dateObj(date).getDay())) dates.push(date);
  else excluded++;
 }
 calendarSelection=new Set(dates); calendarMulti=true; selected=dates[0]||null;
 month=new Date(dateObj(dates[0]||from).getFullYear(),dateObj(dates[0]||from).getMonth(),1);
 renderCalendar();
 message(dates.length+' Tage ausgewählt. '+excluded+' Tage wegen Wochentagsfilter, Wochenende oder Feiertag ausgenommen. Du kannst die Auswahl im Kalender anpassen und anschließend übernehmen.');
 $('calendarCard').scrollIntoView({block:'start'});
}
function changeCalendarPlans(action) {
 const previous=data; let stored;
 try {
  stored=localStorage.getItem('arbeitszeit-v3');
  data={...data,entries:{...data.entries},planned:[...data.planned]};
  action();
 } catch {
  data=previous;
  try {
   if(localStorage.getItem('arbeitszeit-v3')!==stored) {
    if(stored===null) localStorage.removeItem('arbeitszeit-v3');
    else if(stored!==undefined) persistAppData(stored);
   }
  } catch { /* Keep the original in-memory data if browser storage is blocked. */ }
  render();
  $('planInfo').textContent='Die Änderung konnte nicht gespeichert werden. Deine bisherigen Daten wurden beibehalten.';
 }
}
function planCalendarSelection() {
 const dates=calendarDates();
 if(dates.length) changeCalendarPlans(()=>enterVacationDays(dates));
}
function removeCalendarPlans() {
 const dates=new Set(calendarDates()),count=data.planned.filter(d=>dates.has(d)).length;
 if(!count) return;
 changeCalendarPlans(()=>{
  data.planned=data.planned.filter(d=>!dates.has(d));
  save();
  $('planInfo').textContent=count+' Urlaubsplanungen entfernt. Bereits gebuchte Tage bleiben erhalten.';
 });
}
function finishCalendarDrag(cancelled=false) {
 if(!calendarDrag) return;
 const gesture=calendarDrag; calendarDrag=null;
 if(!gesture.dragging) return;
 if(cancelled) { calendarSelection=gesture.before; calendarMulti=gesture.beforeMulti; }
 suppressCalendarClick=true;
 setTimeout(()=>{suppressCalendarClick=false;},0);
 renderCalendar();
}
function initCalendarSelection() {
 $('calendarMulti').onclick=toggleCalendarMulti;
 $('clearCalendarSelection').onclick=clearCalendarSelection;
 $('planRange').onclick=selectCalendarRange;
 $('planWeekdaysAll').onclick=()=>document.querySelectorAll('[data-plan-weekday]').forEach(input=>{input.checked=true;});
 $('planWeekdaysNone').onclick=()=>document.querySelectorAll('[data-plan-weekday]').forEach(input=>{input.checked=false;});
 $('calendar').onclick=clickCalendarDay;
 $('planSelected').onclick=planCalendarSelection;
 $('removeSelected').onclick=removeCalendarPlans;
 // Mouse drag paints one consistent add/remove operation; touch keeps normal scrolling.
 $('calendar').addEventListener('pointerdown',event=>{
  suppressCalendarClick=false;
  const button=event.target.closest('[data-day]');
  if(event.pointerType!=='mouse'||event.button!==0||!button) return;
  const date=button.dataset.day;
  if(!selectableCalendarDay(date)) return;
  calendarDrag={pointer:event.pointerId,date,x:event.clientX,y:event.clientY,add:!calendarSelection.has(date),visited:new Set(),dragging:false,before:new Set(calendarSelection),beforeMulti:calendarMulti};
 });
 document.addEventListener('pointermove',event=>{
  const gesture=calendarDrag;
  if(!gesture||event.pointerId!==gesture.pointer||(event.buttons&1)===0) return;
  if(!gesture.dragging&&Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)<5) return;
  gesture.dragging=true; calendarMulti=true;
  const button=document.elementFromPoint(event.clientX,event.clientY)?.closest('#calendar [data-day]');
  for(const date of [gesture.date,button?.dataset.day].filter(Boolean)) {
   if(gesture.visited.has(date)||!selectableCalendarDay(date)) continue;
   gesture.visited.add(date); selected=date;
   if(gesture.add) calendarSelection.add(date); else calendarSelection.delete(date);
  }
  renderCalendarSelection();
 });
 document.addEventListener('pointerup',event=>{if(calendarDrag?.pointer===event.pointerId)finishCalendarDrag();});
 document.addEventListener('pointercancel',event=>{if(calendarDrag?.pointer===event.pointerId)finishCalendarDrag(true);});
 window.addEventListener('blur',()=>finishCalendarDrag());
}

function renderCalendar() {
 const year=month.getFullYear(), m=month.getMonth();
 $('monthLabel').textContent=month.toLocaleDateString('de-AT',{month:'long',year:'numeric'});
 const first=(new Date(year,m,1).getDay()+6)%7, count=new Date(year,m+1,0).getDate();
 let html=['Mo','Di','Mi','Do','Fr','Sa','So'].map(day=>'<div class="weekday">'+day+'</div>').join('');
 for(let i=0;i<first;i++) html+='<div class="day empty"></div>';
 const holidayList=[];
 for(let day=1;day<=count;day++) {
  const date=year+'-'+String(m+1).padStart(2,'0')+'-'+String(day).padStart(2,'0');
  const holiday=vacationHolidayName(date), used=data.entries[date]?.type==='TU', planned=data.planned.includes(date);
  const extra=!!holiday&&!TimeEngine.holidayName(date);
  if(holiday) holidayList.push('<li><strong>'+formatDate(date)+'</strong> · '+escapeHtml(holiday)+(extra?' · bei dir arbeitsfrei':'')+'</li>');
  const marker=holiday?'Frei':used?'Urlaub':planned?'Plan':'';
  const label=formatDate(date)+(holiday?' · '+holiday+' · arbeitsfrei, kein Urlaubsverbrauch':used?' · Urlaub erfasst':planned?' · Urlaub geplant':'');
  html+='<button type="button" data-day="'+date+'" class="day '+(holiday?'holiday':used?'used':planned?'plan':'')+' '+(calendarSelection.has(date)?'selected':'')+'" aria-label="'+escapeHtml(label)+'" aria-pressed="'+calendarSelection.has(date)+'"'+(holiday?' title="'+escapeHtml(holiday)+'"':'')+'>'+day+(marker?'<span class="dot">'+marker+'</span>':'')+'</button>';
 }
 $('calendar').innerHTML=html;
 $('calendarHolidays').innerHTML=holidayList.length?'<strong>Feiertage und arbeitsfreie Tage</strong><ul>'+holidayList.join('')+'</ul>':'<span>Keine Feiertage oder zusätzlichen arbeitsfreien Tage in diesem Monat.</span>';
 if(selected) {
  const holiday=vacationHolidayName(selected), entry=data.entries[selected];
  const details=[formatDate(selected)];
  if(holiday) details.push(holiday, 'arbeitsfrei · kein Urlaubsverbrauch');
  else if(weekend(selected)) details.push('Wochenende · kein Urlaubsverbrauch');
  if(entry) details.push(entry.type==='TU'?'Bereits als Urlaub erfasst':'Bereits erfasst: '+entry.type);
  else if(data.planned.includes(selected)) details.push('Urlaub geplant'+(!vacationWorkday(selected)?' (wird nicht angerechnet)':''));
  else if(!holiday&&!weekend(selected)) details.push('Noch nicht geplant');
  $('chosenDate').textContent=details.join(' · ');
 } else $('chosenDate').textContent='Wähle einen Tag im Kalender.';
 renderCalendarSelection();
}

function annualDates(until){let out=[];for(let y=dateObj(data.startDate).getFullYear();y<=dateObj(until).getFullYear();y++){let d=`${y}-04-01`;if(d>data.startDate&&d<=until)out.push(d)}return out}function vacationAt(until){let n=Number(data.initialVacation)||0;if(until<data.startDate)return n;for(let d of annualDates(until))n+=Number(data.annualVacation)||0;for(let c of data.credits)if(c.date>=data.startDate&&c.date<=until)n+=Number(c.days)||0;for(let [date,e] of Object.entries(data.entries))if(date>=data.startDate&&date<=until&&e.type==='TU'&&vacationWorkday(date))n--;for(let d of data.planned)if(d>=data.startDate&&d<=until&&!data.entries[d]&&vacationWorkday(d))n--;return n}function futureApril(){let y=today.getFullYear();return todayStr<`${y}-04-01`?`${y}-04-01`:`${y+1}-04-01`}function forecastEnd(){let ds=[todayStr,futureApril(),...data.planned.filter(d=>d>=todayStr&&vacationWorkday(d)),...Object.keys(data.entries).filter(d=>d>=todayStr&&data.entries[d].type==='TU'&&vacationWorkday(d))];return ds.sort().at(-1)}function warnings(){let current=vacationAt(todayStr);if(current<0)return `⚠️ Aktuell fehlen ${fmt(-current)} Urlaubstage. Der eingetragene Urlaub bleibt gespeichert.`;let ds=[...new Set([...data.planned,...Object.keys(data.entries).filter(d=>data.entries[d].type==='TU')])].filter(d=>d>=todayStr&&vacationWorkday(d)).sort();let first=ds.find(d=>vacationAt(d)<0);return first?`⚠️ Am ${formatDate(first)} fehlen voraussichtlich ${fmt(-vacationAt(first))} Urlaubstage. Die Planung bleibt trotzdem gespeichert.`:''}function weekKey(s){let d=dateObj(s),dow=(d.getDay()+6)%7;d.setDate(d.getDate()-dow+3);let y=d.getFullYear(),jan4=new Date(y,0,4,12);let wd=(jan4.getDay()+6)%7;jan4.setDate(jan4.getDate()-wd+3);return `${y}-KW${String(1+Math.round((d-jan4)/604800000)).padStart(2,'0')}`}
const standardShifts=['05:30-13:30','06:00-14:00','13:30-21:30','14:00-22:00','18:00-02:00','21:30-05:30','22:00-06:00'],dayNames=['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'];
function validShift(s){return typeof s==='string'&&/^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/.test(s)&&s.slice(0,5)!==s.slice(6)}
function monday(s){return addDays(s,-((dateObj(s).getDay()+6)%7))}
function dateForWeek(k){let match=/^(\d{4})-KW(\d{2})$/.exec(k);if(!match)return null;let s=monday(match[1]+'-01-04');s=addDays(s,(Number(match[2])-1)*7);return weekKey(s)===k?s:null}
function shiftForDate(s){let k=weekKey(s),day=(dateObj(s).getDay()+6)%7,override=data.shiftDays[k]?.[day];return validShift(override)?override:validShift(data.shifts[k])?data.shifts[k]:'06:00-14:00'}
function shiftOptions(){let all=[...standardShifts,...data.customShifts,...Object.values(data.shifts),...Object.values(data.shiftDays).flatMap(d=>Object.values(d||{}))];return [...new Set(all.filter(validShift))].map(s=>'<option value="'+s+'">'+s.replace('-','–')+(standardShifts.includes(s)?'':' · Eigene Schicht')+'</option>').join('')}
function renderWeekWorkplace(value=data.weekWorkplaces[weekKey($('shiftDate').value)]||'') {
 const names=[...new Set([...data.workplaces,...(value?[value]:[])])];
 $('shiftWorkplace').innerHTML='<option value="">Kein Arbeitsplatz</option>'+names.map(name=>'<option>'+escapeHtml(name)+'</option>').join('');
 $('shiftWorkplace').value=value;
}
function applyEntryWorkplace() {
 if(editing===null) {entryWorkplaceTouched=false;renderEntryWorkplaces(data.weekWorkplaces[weekKey($('entryDate').value)]||'');}
}
function renderShiftList(){let keys=[...new Set([...Object.keys(data.shifts),...Object.keys(data.shiftDays),...Object.keys(data.weekWorkplaces)])].filter(k=>dateForWeek(k)).sort().reverse();$('shiftList').innerHTML=keys.map(k=>{let m=dateForWeek(k),n=Object.values(data.shiftDays[k]||{}).filter(validShift).length;return '<div class="item"><span><b>'+k.replace('-KW',' · KW ')+'</b><br><small>'+formatDate(m)+'–'+formatDate(addDays(m,6))+'<br>'+escapeHtml((data.shifts[k]||'06:00-14:00').replace('-','–'))+(n?' · '+n+' angepasste Tage':' · gesamte Woche')+(data.weekWorkplaces[k]?'<br>Arbeitsplatz: '+escapeHtml(data.weekWorkplaces[k]):'')+'</small></span><button type="button" class="secondary" data-editshift="'+k+'">Bearbeiten</button></div>'}).join('')||'<p class="muted">Noch keine Wochen gespeichert.</p>'}
function loadShiftWeek(){let s=$('shiftDate').value,ok=!!s;$('saveShift').disabled=!ok;$('shiftPrev').disabled=!ok;$('shiftNext').disabled=!ok;if(!ok){$('shiftWeekLabel').textContent='Woche auswählen';$('shiftRange').textContent='';$('shiftInfo').textContent='Bitte ein Datum auswählen.';return}let k=weekKey(s),m=monday(s);$('shiftWeekLabel').textContent=k.replace('-KW',' · KW ');$('shiftRange').textContent=formatDate(m)+' bis '+formatDate(addDays(m,6))+' · Montag bis Sonntag';$('shiftSelect').innerHTML=shiftOptions();$('shiftSelect').value=data.shifts[k]||'06:00-14:00';$('shiftDayFields').innerHTML=dayNames.map((name,i)=>'<label for="shiftDay'+i+'">'+name+' · '+formatDate(addDays(m,i))+'</label><select id="shiftDay'+i+'"><option value="">Wochenschicht übernehmen</option>'+shiftOptions()+'</select>').join('');for(let i=0;i<7;i++)$('shiftDay'+i).value=data.shiftDays[k]?.[i]||'';renderWeekWorkplace();$('shiftInfo').textContent=data.shifts[k]||data.shiftDays[k]||data.weekWorkplaces[k]?'Gespeicherter Wochenplan – Änderungen mit „Wochenplan speichern“ übernehmen.':'Für diese Woche ist noch kein Plan gespeichert.';renderShiftList()}
function renderEntryShiftHint(){let s=$('entryDate').value;if(!s)return;$('entryShiftHint').textContent=weekKey(s).replace('-KW',' · KW ')+' · Schicht '+shiftForDate(s).replace('-','–')+' · '+(editing?'Gespeicherte Arbeitszeiten werden beibehalten.':'Vorgabe aus dem Wochenplan; Uhrzeiten sind frei anpassbar.')}
function applyEntryShift(){let s=$('entryDate').value;if(s&&editing===null){let [start,end]=shiftForDate(s).split('-');$('entryStart').value=start;$('entryEnd').value=end;entryTimesTouched=false}renderEntryShiftHint()}
function hours(s,e){let [sh,sm]=s.split(':').map(Number),[eh,em]=e.split(':').map(Number);let v=(eh*60+em)-(sh*60+sm);return v<0?v+1440:v}function payoutMode(entry,category) {
 return entry['payout'+category] || (entry.payout==='pay'?'pay':'time');
}
function payoutParts(entry,h50,h100) {
 const share=mode=>mode==='pay'?1:mode==='split'?0.5:0;
 const pay50=h50*share(payoutMode(entry,50)),pay100=h100*share(payoutMode(entry,100));
 return {pay50,pay100,paid:pay50+pay100,credit:(h50-pay50)*1.5+(h100-pay100)*2};
}
function formPayout(category) {return $('entryPay'+category).checked?'pay':$('entrySplit'+category).checked?'split':'time';}
function loadPayout(entry={}) {for(const category of [50,100]) {const mode=payoutMode(entry,category);$('entryPay'+category).checked=mode==='pay';$('entrySplit'+category).checked=mode==='split';}}
const TimeEngine=(()=>{// Pure minute arithmetic for the replacement calculation. Business rules are
// supplied separately so time windows do not accidentally become overtime.
function minutes(value){
 if(typeof value!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))throw new Error('Ungültige Uhrzeit');
 const [h,m]=value.split(':').map(Number);return h*60+m;
}
function span(start,end){const a=minutes(start),b=minutes(end);if(a===b)throw new Error('Beginn und Ende müssen unterschiedlich sein');return [a,b<a?b+1440:b]}
function overlap(a,b){return Math.max(0,Math.min(a[1],b[1])-Math.max(a[0],b[0]))}
function merge(ranges){
 const sorted=ranges.filter(([a,b])=>b>a).map(r=>[...r]).sort((a,b)=>a[0]-b[0]);const out=[];
 for(const range of sorted){const last=out.at(-1);if(last&&range[0]<=last[1])last[1]=Math.max(last[1],range[1]);else out.push(range)}return out;
}
function subtract(ranges,cuts){
 let out=merge(ranges);for(const [a,b] of merge(cuts)){out=out.flatMap(([s,e])=>e<=a||s>=b?[[s,e]]:[[s,Math.min(e,a)],[Math.max(s,b),e]].filter(([x,y])=>y>x))}return out;
}
function duration(ranges){return merge(ranges).reduce((n,[s,e])=>n+e-s,0)}
function intersection(a,b){const out=[];for(const x of merge(a))for(const y of merge(b)){const s=Math.max(x[0],y[0]),e=Math.min(x[1],y[1]);if(e>s)out.push([s,e])}return merge(out)}
function dailyWindows(work,start,end){
 const [s,e]=span(start,end),out=[];for(let day=Math.floor(work[0]/1440)-1;day<=Math.floor(work[1]/1440);day++){const a=Math.max(work[0],day*1440+s),b=Math.min(work[1],day*1440+e);if(b>a)out.push([a,b])}return merge(out);
}
function splitDays(ranges){
 const out=[];for(const [s,e] of merge(ranges)){for(let day=Math.floor(s/1440);day<Math.ceil(e/1440);day++){const a=Math.max(s,day*1440),b=Math.min(e,(day+1)*1440);if(b>a)out.push({day,start:a-day*1440,end:b-day*1440,minutes:b-a})}}return out;
}
const DAY=1440,NORMAL=462;
function dateDay(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Ungültiges Datum');const ms=Date.parse(date+'T00:00:00Z');if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==date)throw Error('Ungültiges Datum');return ms/86400000}
function dayDate(day){return new Date(day*86400000).toISOString().slice(0,10)}
function dow(day){return new Date(day*86400000).getUTCDay()}
function weekStart(day){return day-((dow(day)+6)%7)}
const holidayCache=new Map();
function holidays(year){
 if(holidayCache.has(year))return holidayCache.get(year);
 // Gregorian Easter (Meeus/Jones/Butcher); dates are wall-clock calendar dates.
 const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31),day=(h+l-7*m+114)%31+1;
 const easter=Date.UTC(year,month-1,day)/86400000,out=new Map();
 for(const [date,name] of [['01-01','Neujahr'],['01-06','Heilige Drei Könige'],['05-01','Staatsfeiertag'],['08-15','Mariä Himmelfahrt'],['10-26','Nationalfeiertag'],['11-01','Allerheiligen'],['12-08','Mariä Empfängnis'],['12-25','Weihnachten'],['12-26','Stephanstag']])out.set(year+'-'+date,name);
 for(const [offset,name] of [[1,'Ostermontag'],[39,'Christi Himmelfahrt'],[50,'Pfingstmontag'],[60,'Fronleichnam']])out.set(dayDate(easter+offset),name);
 holidayCache.set(year,out);return out;
}
function holidayName(date){return holidays(Number(date.slice(0,4))).get(date)||''}
function prepare(date,entry,shift){
 const base=dateDay(date)*DAY,work=span(entry.start,entry.end).map(n=>n+base),scheduled=span(...shift.split('-')).map(n=>n+base),pause=Number(entry.break);
 if(!Number.isInteger(pause)||pause<0||pause>=work[1]-work[0])throw Error('Pause muss kürzer als die Anwesenheit sein');
 // A single duration has no timestamp: deduct inside the normal shift first,
 // then deduct any remaining pause from overtime in chronological order.
 let left=pause,cuts=[];
 for(const [s,e] of [...intersection([work],[scheduled]),...subtract([work],[scheduled])]){const n=Math.min(left,e-s);if(n>0)cuts.push([s,s+n]);left-=n;if(!left)break;}
 const net=subtract([work],cuts);
 const exempt=[0,6].includes(dow(dateDay(date)))||!!holidayName(date);
 return {date,entry,scheduled,work,net,workedMinutes:duration(net),shortfall:exempt?0:Math.max(0,NORMAL-duration(net)),segments:[],auto50:0,auto100:0};
}
function calculate(entries,shiftForDate){
 const records=[],results={},errorResults={};
 for(const [date,entry] of Object.entries(entries)){
  if(entry.type!=='Arbeit'){results[date]={worked:0,h50:0,h100:0,overtime:0,credit:0,balance:entry.type==='ZA'?-NORMAL/60:0,auto50:0,auto100:0,shortfall:0,segments:[]};continue}
  try{records.push(prepare(date,entry,shiftForDate(date)))}catch(error){errorResults[date]={error:error.message,worked:0,h50:0,h100:0,overtime:0,credit:0,balance:0,auto50:0,auto100:0,shortfall:0,segments:[]}}
 }
 const overlaps=new Set();const ordered=[...records].sort((a,b)=>a.work[0]-b.work[0]);
 for(let i=0;i<ordered.length;i++)for(let j=i+1;j<ordered.length&&ordered[j].work[0]<ordered[i].work[1];j++){overlaps.add(ordered[i].date);overlaps.add(ordered[j].date)}
 for(const date of overlaps)errorResults[date]={error:'Arbeitszeit überschneidet sich mit einem anderen gespeicherten Tag. Bitte Zeiten prüfen.',worked:0,h50:0,h100:0,overtime:0,credit:0,balance:0,auto50:0,auto100:0,shortfall:0,segments:[]};
 // Normalarbeitszeit wird aus der gesamten Nettozeit aufgefüllt (7:42 h).
 // Nur der Überschuss ist Überstunde. Früh geleistete Zeiten behalten
 // bei der Zuordnung ihren ursprünglichen zeitabhängigen Zuschlag.
 for(const r of records){
  const special=[0,6].includes(dow(dateDay(r.date)))||!!holidayName(r.date);
  let remaining=special?r.workedMinutes:Math.max(0,r.workedMinutes-NORMAL);
  const before=intersection(r.net,[[r.work[0],r.scheduled[0]]]);
  const after=intersection(r.net,[[r.scheduled[1],r.work[1]]]);
  const inside=intersection(r.net,[r.scheduled]);
  const chosen=[];
  for(const [a,b] of [...before,...after,...inside.slice().reverse()]){
   if(remaining<=0)break;
   const take=Math.min(remaining,b-a);
   if(take>0){chosen.push(inside.some(([x,y])=>x===a&&y===b)?[b-take,b]:[a,a+take]);remaining-=take;}
  }
  r.overtimeRanges=merge(chosen);
 }
 const timeline=[];
 for(const r of records){if(overlaps.has(r.date))continue;let elapsed=0;for(const [s,e] of r.net){timeline.push({minute:s,end:e,r,elapsed});elapsed+=e-s;}}
 timeline.sort((a,b)=>a.minute-b.minute||a.r.date.localeCompare(b.r.date));
 const weeks=new Map();
 for(const item of timeline){
  const r=item.r;let minute=item.minute,elapsed=item.elapsed;
  while(minute<item.end){
  const day=Math.floor(minute/DAY),clock=minute-day*DAY,weekday=dow(dateDay(r.date)),date=dayDate(day),week=weekStart(dateDay(r.date)),previous=weeks.get(week)||0;
  const boundaries=[item.end,(day+1)*DAY,day*DAY+360,day*DAY+1320,r.scheduled[0],r.scheduled[1],minute+(600-elapsed),minute+(720-elapsed),minute+(3000-previous),...r.overtimeRanges.flatMap(([a,b])=>[a,b])];
  const end=Math.min(...boundaries.filter(n=>n>minute)),length=end-minute;
  weeks.set(week,previous+length);
  const before=minute<r.scheduled[0],after=minute>=r.scheduled[1],sunday=weekday===0||dow(day)===0,holiday=!!holidayName(date),saturday=weekday===6,daily=elapsed>=600&&elapsed<720;
  const isOvertime=r.overtimeRanges.some(([a,b])=>minute>=a&&minute<b);
  const reasons=[];let rate=0;
  if(isOvertime){
   if(sunday)reasons.push('Sonntag');if(holiday)reasons.push(holidayName(date));
   if(before&&clock<360)reasons.push('Vor der Schicht und vor 06:00');
   if(after&&(clock>=1320||day>Math.floor(r.scheduled[1]/DAY)&&clock<360))reasons.push('Nach der Schicht ab 22:00');
   // An overnight planned shift ending at 02:00 extends into the following
   // morning: 02:00–06:00 stays in the late-shift night window.
   if(after&&r.scheduled[1]%DAY<360&&clock<360&&!reasons.includes('Nach der Schicht ab 22:00'))reasons.push('Nach der Nachtschicht vor 06:00');
   if(daily)reasons.push('11. oder 12. Nettoarbeitsstunde');
   if(saturday&&previous>=3000)reasons.push('Über 50 Netto-Wochenstunden');
   rate=reasons.length?100:50;if(rate===100)r.auto100+=length;else r.auto50+=length;
  }
  const label=rate===0?(r.shortfall?'Unter 7 h 42 min – Zeittopf-Abzug':'Reguläre Arbeitszeit'):rate===50?'Überstunden mit 50 %':reasons.join(' · ');
  const last=r.segments.at(-1);if(last&&last.end===minute&&last.rate===rate&&last.reason===label)last.end=end;else r.segments.push({start:minute,end,rate,reason:label});
  minute=end;elapsed+=length;
  }
 }
 for(const r of records){if(overlaps.has(r.date))continue;
  let h50=r.auto50/60,h100=r.auto100/60;
  const override=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>=0;
  if(!r.shortfall){if(override(r.entry.override50))h50=Number(r.entry.override50);if(override(r.entry.override100))h100=Number(r.entry.override100);}
  const {credit,pay50,pay100,paid}=payoutParts(r.entry,h50,h100);
  results[r.date]={worked:r.workedMinutes/60,h50,h100,overtime:h50+h100,credit,pay50,pay100,paid,balance:credit-r.shortfall/60,auto50:r.auto50/60,auto100:r.auto100/60,shortfall:r.shortfall/60,segments:r.segments,overridden:!r.shortfall&&(override(r.entry.override50)||override(r.entry.override100))};
 }
 return {...results,...errorResults};
}
return {minutes,span,overlap,merge,subtract,duration,intersection,dailyWindows,splitDays,dateDay,dayDate,holidayName,holidays,prepare,calculate};
})();let calculationCache=null;
function workDetails(e,date){if(!calculationCache)calculationCache=TimeEngine.calculate(data.entries,shiftForDate);return calculationCache[date]||{worked:0,h50:0,h100:0,overtime:0,credit:0,balance:0,segments:[],shortfall:0}}
function draftEntry(){return {type:$('entryType').value,start:$('entryStart').value,end:$('entryEnd').value,break:Number($('entryBreak').value),payout50:formPayout(50),payout100:formPayout(100),override50:$('entry50').value===''?null:Number($('entry50').value),override100:$('entry100').value===''?null:Number($('entry100').value)}}
function minuteLabel(n,entryDate){let day=Math.floor(n/1440),clock=n-day*1440,date=TimeEngine.dayDate(day);return String(Math.floor(clock/60)).padStart(2,'0')+':'+String(clock%60).padStart(2,'0')+(date===entryDate?'':' ('+formatDate(date)+')')}
function renderEntryCalculation(){let panel=$('entryCalculation'),date=$('entryDate').value;panel.hidden=$('entryType').value!=='Arbeit';if(panel.hidden)return;if(!date||!$('entryStart').value||!$('entryEnd').value){panel.textContent='Datum, Beginn und Ende eingeben.';return}let entries={...data.entries};if(editing&&editing!==date)delete entries[editing];entries[date]=draftEntry();let result=TimeEngine.calculate(entries,shiftForDate)[date];if(result.error){panel.textContent=result.error;return}panel.innerHTML='<h4 class="calculation-heading">Berechnung für diesen Tag</h4><div class="calculation-grid"><div><span class="mini">Nettoarbeitszeit</span><strong>'+fmt(result.worked)+' h</strong></div><div><span class="mini">Überstunden gesamt</span><strong>'+fmt(result.overtime)+' h</strong></div><div><span class="mini">Überstunden 50 %</span><strong>'+fmt(result.h50)+' h</strong></div><div><span class="mini">Überstunden 100 %</span><strong>'+fmt(result.h100)+' h</strong></div></div><div class="calculation-amount">'+('Zeitgutschrift inkl. Zuschlägen: <b>'+fmt(result.credit)+' h</b><br>Zur Auszahlung (Stunden ohne Zuschlagsfaktor): <b>'+fmt(result.pay50||0)+' h mit 50 % · '+fmt(result.pay100||0)+' h mit 100 %</b>')+'</div>'+(result.shortfall?'<div class="calculation-amount">Fehlende Normalarbeitszeit: <b>−'+fmt(result.shortfall)+' h aus dem Zeittopf</b></div>':'')+'<div class="mini" style="margin-top:8px">'+(result.overridden?'Manuelle Überschreibung aktiv. Automatisch: '+fmt(result.auto50)+' h mit 50 %, '+fmt(result.auto100)+' h mit 100 %.':result.shortfall?'Manuelle Überstundenwerte werden unter 7 h 42 min nicht gebucht.':'Automatisch nach deinen Regeln berechnet.')+'</div><details style="margin-top:10px"><summary style="min-height:44px;padding:10px 0;cursor:pointer">Zeitabschnitte &amp; Zuschläge</summary>'+result.segments.map(s=>'<div class="calculation-segment"><b>'+minuteLabel(s.start,date)+'–'+minuteLabel(s.end,date)+' · '+fmt((s.end-s.start)/60)+' h'+(s.rate?' · '+s.rate+' %':'')+'</b><span>'+escapeHtml(s.reason)+'</span></div>').join('')+'</details>'}
function calc(e,date){return workDetails(e,date).balance}function monthlySummary(){let totals={pay50:0,pay100:0,credit:0,worked:0,overtime:0};for(let [d,e] of Object.entries(data.entries)){if(!d.startsWith(todayStr.slice(0,7))||d>todayStr||e.type!=='Arbeit')continue;let detail=workDetails(e,d);totals.worked+=detail.worked;totals.overtime+=detail.overtime;totals.pay50+=detail.pay50||0;totals.pay100+=detail.pay100||0;totals.credit+=detail.credit;}return totals}function renderMonthlySummary(){let totals=monthlySummary();$('summaryMonth').textContent=today.toLocaleDateString('de-AT',{month:'long',year:'numeric'});for(let [id,key] of Object.entries({monthPay100:'pay100',monthPay50:'pay50',monthTimeCredit:'credit',monthWorked:'worked',monthOvertime:'overtime'}))$(id).textContent=fmt(totals[key])+' h';}function timeBalance(){let n=Number(data.initialTime)||0;for(let [d,e] of Object.entries(data.entries))if(d>=data.startDate&&d<=todayStr)n+=calc(e,d);return round(n)}function closeSettingsPanels(){document.querySelectorAll('#settings>details.settings-panel').forEach(panel=>panel.open=false);}
function switchTab(id){if(id!=='settings')closeSettingsPanels();document.querySelectorAll('main section').forEach(s=>s.hidden=s.id!==id);document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));$('heading').textContent={overview:'Übersicht',entry:'Zeiterfassung',vacation:'Urlaubsplanung',year:'Jahresübersicht',settings:'Einstellungen'}[id];render()}function render(){refreshAppDate(false);calculationCache=null;document.body.classList.toggle('dark',data.theme==='dark');document.documentElement.style.colorScheme=data.theme==='dark'?'dark':'light';document.querySelector('meta[name="theme-color"]').content=data.theme==='dark'?'#0b1728':'#f3f6fa';renderLastBackup();renderMonthlySummary();$('today').textContent=today.toLocaleDateString('de-AT',{weekday:'long',day:'numeric',month:'long',year:'numeric'});$('balance').textContent=fmt(timeBalance())+' h';$('vacCurrent').textContent=fmt(vacationAt(todayStr))+' Tage';$('vacApril').textContent=`Am ${formatDate(futureApril())}: ${fmt(vacationAt(futureApril()))} Tage`;$('vacAfter').textContent=`Nach allen Planungen: ${fmt(vacationAt(forecastEnd()))} Tage`;$('overviewWarning').innerHTML=(warnings()?`<div class="notice warning">${warnings()}</div>`:'')+Object.entries(calculationCache||{}).filter(([,r])=>r.error).map(([d,r])=>'<div class="notice warning">'+formatDate(d)+': '+escapeHtml(r.error)+' Dieser Eintrag wird bis zur Korrektur nicht berechnet.</div>').join('');let entries=Object.entries(data.entries).sort((a,b)=>b[0].localeCompare(a[0]));$('recent').innerHTML=entries.slice(0,4).map(([d,e])=>`<div class="recorded-entry-row"><button type="button" class="recent-entry" data-edit="${d}" aria-label="Tag ${formatDate(d)} bearbeiten"><span class="recent-date"><span class="icon-badge"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18"/></svg></span>${formatDate(d)}</span><span class="recent-time">${e.type==='Arbeit'?e.start+'–'+e.end:escapeHtml(e.type)}</span><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button>${entryDeleteButton(d)}</div>`).join('')||'<p class="muted">Noch keine Tage erfasst.</p>';$('entryList').innerHTML=entries.slice(0,50).map(([d,e])=>`<div class="item"><span class="entry-list-text">${formatDate(d)} · ${escapeHtml(e.type)}<br><small>${e.type==='Arbeit'?e.start+'–'+e.end+' · '+e.break+' min Pause':''}</small></span><div class="entry-actions"><button type="button" class="secondary" data-edit="${d}">Bearbeiten</button>${entryDeleteButton(d)}</div></div>`).join('')||'<p class="muted">Keine Einträge.</p>';renderEntryWorkplaces();renderCalendar();$('planCurrent').textContent=fmt(vacationAt(todayStr))+' Tage';$('planApril').textContent=fmt(vacationAt(futureApril()))+' Tage';$('aprilLabel').textContent='Am '+formatDate(futureApril());$('planAfter').textContent=fmt(vacationAt(forecastEnd()))+' Tage';$('vacWarnings').innerHTML=warnings()?`<div class="notice warning">${warnings()}</div>`:'<div class="notice success">✓ Für die derzeit geplanten Urlaubstage ist ausreichend Urlaub verfügbar.</div>';renderYear();renderWorkplaces();renderCredits();renderShiftList();renderEntryShiftHint();renderEntryCalculation()}function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}let yearMeasure='worked',yearMonth=today.getMonth();
const yearMonthNames=['Jänner','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
function yearEntriesFor(y){return Object.entries(data.entries).filter(([d])=>d.startsWith(y+'-')).sort((a,b)=>b[0].localeCompare(a[0]))}
function yearMonthTotals(entries){let months=Array.from({length:12},()=>({worked:0,overtime:0,days:0,work:0,vacation:0,za:0,sick:0,accident:0}));for(let [d,e] of entries){let m=Number(d.slice(5,7))-1;if(m<0||m>11)continue;let value=months[m],detail=workDetails(e,d);value.days++;value.worked+=detail.worked;value.overtime+=detail.overtime;if(e.type==='Arbeit')value.work++;if(e.type==='TU'&&vacationWorkday(d))value.vacation++;if(e.type==='ZA')value.za++;if(e.type==='KK')value.sick++;if(e.type==='KU')value.accident++;}return months}
function chooseYearMonth(){let y=$('yearSelect').value,entries=yearEntriesFor(y);yearMonth=y===String(today.getFullYear())?today.getMonth():entries.length?Number(entries[0][0].slice(5,7))-1:0;renderYear()}
function renderYear(){
let y=$('yearSelect').value||String(today.getFullYear());
for(let savedYear of [...new Set(Object.keys(data.entries).map(d=>d.slice(0,4)))].filter(y=>/^\d{4}$/.test(y))){if(!Array.from($('yearSelect').options).some(o=>o.value===savedYear))$('yearSelect').add(new Option(savedYear,savedYear));}
let entries=yearEntriesFor(y),months=yearMonthTotals(entries),sum=key=>months.reduce((n,m)=>n+m[key],0);
$('yearTotalLabel').textContent='Arbeitsstunden · '+y;$('yearTotalWorked').textContent=fmt(sum('worked'))+' h';$('yearTotalOvertime').textContent=fmt(sum('overtime'))+' h Überstunden im Jahr';
$('yearStats').innerHTML=[['Arbeitstage','work'],['Urlaubstage','vacation'],['Zeitausgleich','za'],['KK · Krankenstand','sick'],['KU · Arbeitsunfall','accident']].map(([label,key])=>'<div class="year-stat"><strong>'+sum(key)+'</strong><span>'+label+'</span></div>').join('');
for(let b of document.querySelectorAll('[data-year-measure]'))b.setAttribute('aria-pressed',String(b.dataset.yearMeasure===yearMeasure));
let peak=Math.max(0,...months.map(m=>m[yearMeasure])),step=peak>100?20:peak>20?10:peak>5?5:1,max=Math.max(step,Math.ceil(peak/step)*step);
$('yearBars').innerHTML=months.map((m,i)=>'<button type="button" class="year-bar-row '+(m.days?'':'no-entries')+'" data-year-month="'+i+'" aria-pressed="'+(i===yearMonth)+'" aria-label="'+yearMonthNames[i]+' '+y+': '+(m.days?fmt(m[yearMeasure])+' Stunden '+(yearMeasure==='worked'?'Arbeitszeit':'Überstunden'):'keine Einträge')+'"><span class="year-bar-month">'+yearMonthNames[i].slice(0,3)+'</span><span class="year-bar-track" aria-hidden="true"><span class="year-bar-fill" style="width:'+Math.max(0,Math.min(100,m[yearMeasure]/max*100))+'%"></span></span><span class="year-bar-value">'+(m.days?fmt(m[yearMeasure])+' h':'—')+'</span></button>').join('');
$('yearAxisMax').textContent=fmt(max)+' h';let m=months[yearMonth],monthEntries=entries.filter(([d])=>Number(d.slice(5,7))-1===yearMonth),title=yearMonthNames[yearMonth]+' '+y;
$('yearMonthSummary').innerHTML='<strong>'+title+'</strong>'+(m.days?'<span>'+fmt(m.worked)+' h Arbeitszeit · '+fmt(m.overtime)+' h Überstunden</span><span>'+m.work+' Arbeitstage · '+m.vacation+' Urlaub · '+m.za+' ZA · '+m.sick+' KK · '+m.accident+' KU</span>':'<span>Noch keine Einträge für diesen Monat.</span>');
$('yearEntriesHeading').textContent=yearMonthNames[yearMonth]+' · erfasst';$('yearEntryCount').textContent=m.days+' '+(m.days===1?'Tag':'Tage');
const names={Arbeit:'Arbeit',TU:'Urlaub',ZA:'Zeitausgleich',KK:'KK – Krankenstand',KU:'KU – Krankstand/Arbeitsunfall',Feiertag:'Feiertag',Frei:'Frei'};
$('yearEntries').innerHTML=monthEntries.map(([d,e])=>{let value=workDetails(e,d);return '<div class="recorded-entry-row"><button type="button" class="year-entry" data-edit="'+d+'" aria-label="'+formatDate(d)+' bearbeiten"><span><b>'+formatDate(d)+' · '+escapeHtml(names[e.type]||e.type)+'</b><small>'+(e.type==='Arbeit'?escapeHtml(e.start)+'–'+escapeHtml(e.end)+' · '+fmt(value.worked)+' h Arbeitszeit<br>'+fmt(value.overtime)+' h Überstunden':'')+'</small></span><span class="year-entry-arrow" aria-hidden="true">›</span></button>'+entryDeleteButton(d)+'</div>'}).join('')||'<p class="muted">Noch keine Tage erfasst.</p>';
}
function renderWorkplaces(){$('workplaceList').innerHTML=data.workplaces.map((w,i)=>`<div class="item"><span>${escapeHtml(w)}</span><button class="secondary" data-rename="${i}">Bearbeiten</button><button class="danger" data-deletework="${i}">Löschen</button></div>`).join('')}function renderCredits(){$('creditList').innerHTML=data.credits.map((c,i)=>`<div class="item"><span>${formatDate(c.date)}: ${fmt(c.days)} Tage</span><button class="danger" data-deletecredit="${i}">Löschen</button></div>`).join('')}function entryDeleteButton(date) {
 const label = 'Tag ' + formatDate(date) + ' löschen';
 return '<button type="button" class="danger entry-delete" data-delete-entry="' + date + '" aria-label="' + label + '" title="' + label + '"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></svg></button>';
}
function entryListAction(event) {
 const remove = event.target.closest('[data-delete-entry]');
 if (remove) { deleteEntry(remove.dataset.deleteEntry); return; }
 const edit = event.target.closest('[data-edit]');
 if (edit) editEntry(edit.dataset.edit);
}
function deleteEntry(date) {
 if (!Object.hasOwn(data.entries, date)) return;
 const names = {Arbeit:'Arbeit', TU:'Urlaub', ZA:'Zeitausgleich', KK:'KK – Krankenstand',KU:'KU – Krankstand/Arbeitsunfall', Feiertag:'Feiertag', Frei:'Frei'};
 const kind = names[data.entries[date].type] || data.entries[date].type;
 if (!confirm('Möchtest du diesen Tag wirklich löschen?\n\n' + formatDate(date) + ' · ' + kind + '\n\nDer gespeicherte Eintrag wird entfernt und alle betroffenen Salden werden neu berechnet.')) return;
 const previous = data;
 let previousStored;
 try {
  previousStored = localStorage.getItem('arbeitszeit-v3');
  const entries = {...data.entries};
  delete entries[date];
  // Remove any matching vacation plan too, so a booked day cannot reappear.
  data = {...data, entries, planned:data.planned.filter(d => d !== date)};
  persistAppData(JSON.stringify(data));
 } catch {
  data = previous;
  alert('Der Tag konnte nicht gelöscht werden. Deine bisherigen Daten bleiben erhalten.');
  return;
 }
 try {
  const workplace = $('entryWorkplace').value;
  render(); // Invalidates the shared cache, including the weekly overtime totals.
  if (editing === date || $('entryDate').value === date) resetEntry();
  else $('entryWorkplace').value = workplace;
 } catch {
  data = previous;
  if (previousStored === null) localStorage.removeItem('arbeitszeit-v3');
  else persistAppData(previousStored);
  render();
  alert('Der Tag konnte nicht gelöscht werden. Deine bisherigen Daten bleiben erhalten.');
  return;
 }
 const status = $('deleteStatus');
 status.textContent = formatDate(date) + ' · ' + kind + ' gelöscht. Die Salden wurden aktualisiert.';
 status.hidden = false;
}

function resetEntry(){refreshAppDate(false);editing=null;$('entryForm').reset();loadPayout();entryWorkplaceTouched=false;$('entryDate').value=todayStr;$('entryBreak').value=data.defaultBreak;$('entryInfo').hidden=true;toggleWork();applyEntryShift();applyEntryWorkplace();renderEntryCalculation()}function toggleWork(){const work=$('entryType').value==='Arbeit';$('workFields').hidden=!work;$('workFields').querySelectorAll('input,select').forEach(field=>field.disabled=!work);renderEntryShiftHint();renderEntryCalculation()}function editEntry(d){let e=data.entries[d];if(!e)return;editing=d;entryWorkplaceTouched=true;$('entryDate').value=d;$('entryType').value=e.type;$('entryStart').value=e.start||'06:00';$('entryEnd').value=e.end||'14:00';$('entryBreak').value=e.break??data.defaultBreak;loadPayout(e);$('entry50').value=e.override50??'';$('entry100').value=e.override100??'';$('entryNote').value=e.note||'';toggleWork();switchTab('entry');renderEntryWorkplaces(e.workplace||'');window.scrollTo(0,0)}function init(){$('appVersion').textContent='v'+APP_VERSION;$('creatorVersion').textContent='Version v'+APP_VERSION;initReports();$('resetData').onclick=showResetDataDialog;$('cancelResetData').onclick=()=>$('resetDataDialog').close();$('confirmResetData').onclick=resetAllAppData;if(realizePastVacation())persistAppData(JSON.stringify(data));document.querySelectorAll('.tabs button').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));$('entryType').onchange=toggleWork;for(const category of [50,100])for(const mode of ['Pay','Split'])$('entry'+mode+category).onchange=()=>{const field=$('entry'+mode+category);if(field.checked)$('entry'+(mode==='Pay'?'Split':'Pay')+category).checked=false;renderEntryCalculation();};$('entryReset').onclick=resetEntry;$('entryForm').onsubmit=e=>{e.preventDefault();refreshAppDate(false);let d=$('entryDate').value,type=$('entryType').value;if(!d)return;let item=type==='Arbeit'?{type,start:$('entryStart').value,end:$('entryEnd').value,break:Number($('entryBreak').value),payout50:formPayout(50),payout100:formPayout(100),override50:$('entry50').value===''?null:Number($('entry50').value),override100:$('entry100').value===''?null:Number($('entry100').value),note:$('entryNote').value,workplace:$('entryWorkplace').value}:{type,note:$('entryNote').value};if(type==='Arbeit'){let entries={...data.entries};if(editing&&editing!==d)delete entries[editing];entries[d]=item;let result=TimeEngine.calculate(entries,shiftForDate)[d];if(result.error){alert(result.error);return}if([item.override50,item.override100].some(v=>v!==null&&(!Number.isFinite(v)||v<0))){alert('Bitte gültige Überstundenwerte eingeben.');return}} if(editing&&editing!==d)delete data.entries[editing];data.entries[d]=item;if(type==='TU')data.planned=data.planned.filter(x=>x!==d);save();$('entryInfo').hidden=false;$('entryInfo').textContent='Tag gespeichert. Du kannst ihn unten erneut bearbeiten.';editing=d;renderEntryCalculation()};$('recent').onclick=entryListAction;$('entryList').onclick=entryListAction;$('monthPrev').onclick=()=>{month.setMonth(month.getMonth()-1);selected=null;renderCalendar()};$('monthNext').onclick=()=>{month.setMonth(month.getMonth()+1);selected=null;renderCalendar()};initCalendarSelection();
for(let y=today.getFullYear()-3;y<=today.getFullYear()+5;y++)$('yearSelect').add(new Option(String(y),String(y)));$('yearSelect').value=String(today.getFullYear());$('yearSelect').onchange=chooseYearMonth;
document.querySelectorAll('[data-year-measure]').forEach(b=>b.onclick=()=>{yearMeasure=b.dataset.yearMeasure;renderYear()});
$('yearBars').onclick=e=>{let b=e.target.closest('[data-year-month]');if(b){yearMonth=Number(b.dataset.yearMonth);renderYear()}};
$('yearEntries').onclick=entryListAction;$('saveSettings').onclick=saveAppSettings;$('addWorkplace').onclick=()=>{let s=$('newWorkplace').value.trim();if(s&&!data.workplaces.includes(s)){data.workplaces.push(s);$('newWorkplace').value='';save()}};$('workplaceList').onclick=e=>{let b=e.target.closest('button');if(!b)return;if(b.dataset.rename!==undefined){let i=Number(b.dataset.rename),v=prompt('Arbeitsplatz bearbeiten',data.workplaces[i]);if(v?.trim()){data.workplaces[i]=v.trim();save()}}if(b.dataset.deletework!==undefined){data.workplaces.splice(Number(b.dataset.deletework),1);save()}};$('shiftDate').onchange=loadShiftWeek;
$('shiftPrev').onclick=()=>{$('shiftDate').value=addDays($('shiftDate').value,-7);loadShiftWeek()};
$('shiftNext').onclick=()=>{$('shiftDate').value=addDays($('shiftDate').value,7);loadShiftWeek()};
$('saveShift').onclick=()=>{let s=$('shiftDate').value;if(!s){loadShiftWeek();return}let k=weekKey(s),shift=$('shiftSelect').value;if(!validShift(shift))return;const previousWeekWorkplaces={...data.weekWorkplaces},previousShifts={...data.shifts},previousDays={...data.shiftDays};data.shifts[k]=shift;if($('shiftWorkplace').value)data.weekWorkplaces[k]=$('shiftWorkplace').value;else delete data.weekWorkplaces[k];let days={};for(let i=0;i<7;i++){let v=$('shiftDay'+i).value;if(validShift(v))days[i]=v}if(Object.keys(days).length)data.shiftDays[k]=days;else delete data.shiftDays[k];try{save();}catch{data.weekWorkplaces=previousWeekWorkplaces;data.shifts=previousShifts;data.shiftDays=previousDays;render();$('shiftInfo').textContent='Wochenplan konnte nicht gespeichert werden. Der bisherige Plan bleibt erhalten.';return;}if(editing===null&&!entryWorkplaceTouched)applyEntryWorkplace();$('shiftInfo').textContent=k.replace('-KW',' · KW ')+' gespeichert. Die Zeiterfassung übernimmt die Schichten für neue Einträge.';if(editing===null&&!entryTimesTouched){applyEntryShift();renderEntryCalculation()}};
$('shiftList').onclick=e=>{let b=e.target.closest('[data-editshift]');if(b){$('shiftDate').value=dateForWeek(b.dataset.editshift);loadShiftWeek();$('shiftCard').scrollIntoView({block:'start',behavior:'smooth'})}};
$('addCustomShift').onclick=()=>{let s=$('customShiftStart').value+'-'+$('customShiftEnd').value;if(!validShift(s)){$('customShiftInfo').textContent='Bitte gültige, unterschiedliche Uhrzeiten eingeben.';return}if(!standardShifts.includes(s)&&!data.customShifts.includes(s))data.customShifts.push(s);let selected=$('shiftSelect').value,days=dayNames.map((_,i)=>$('shiftDay'+i)?.value||'');$('shiftSelect').innerHTML=shiftOptions();$('shiftSelect').value=s;for(let i=0;i<7;i++){let el=$('shiftDay'+i);if(el){el.innerHTML='<option value="">Wochenschicht übernehmen</option>'+shiftOptions();el.value=days[i]}}save();$('customShiftInfo').textContent='Schicht '+s.replace('-','–')+' hinzugefügt und ausgewählt. Mit „Wochenplan speichern“ zuweisen.'};
$('entryWorkplace').onchange=()=>{entryWorkplaceTouched=true;};$('entryDate').onchange=()=>{let s=$('entryDate').value;if(!s)return;if(data.entries[s]){editEntry(s);return}editing=null;$('entryInfo').hidden=true;applyEntryShift();applyEntryWorkplace();renderEntryCalculation()};
for(let id of ['entryStart','entryEnd'])$(id).oninput=()=>{entryTimesTouched=true;renderEntryCalculation()};for(let id of ['entryBreak','entry50','entry100'])$(id).addEventListener('input',renderEntryCalculation);
$('addCredit').onclick=()=>{let d=$('creditDate').value,n=Number($('creditDays').value);if(d&&Number.isFinite(n)&&n!==0){data.credits.push({date:d,days:n});save()}};$('creditList').onclick=e=>{let b=e.target.closest('[data-deletecredit]');if(b){data.credits.splice(Number(b.dataset.deletecredit),1);save()}};$('exportData').onclick=exportBackup;$('importData').onchange=importBackup;$('entryDate').value=todayStr;$('shiftDate').value=todayStr;$('creditDate').value=todayStr;$('planFrom').value=todayStr;$('planTo').value=todayStr;fillSettings();resetEntry();render()}// Complete backup and restore. Calculations and normal entry saving stay unchanged.
const backupFormat = 'arbeitszeit-backup', backupVersion = 1;
function backupMessage(text, kind = '') {
 const status = $('backupStatus');
 status.hidden = false;
 status.className = 'notice ' + kind;
 status.textContent = text;
}
function backupDate(value) {
 return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(dateObj(value).getTime()) && dateISO(dateObj(value)) === value;
}
function validateBackup(input) {
 const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
 const number = value => typeof value === 'number' && Number.isFinite(value);
 const time = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
 const check = (condition, message) => { if (!condition) throw new Error(message); };
 // Do not allow special object keys to reach application maps or merges.
 function checkKeys(value) {
  if (!value || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
   check(!['__proto__', 'prototype', 'constructor'].includes(key), 'Die Datei enthält ungültige Datenfelder.');
   checkKeys(value[key]);
  }
 }
 check(object(input), 'Bitte eine Sicherungsdatei dieser Arbeitszeit-App auswählen.');
 checkKeys(input);
 let raw = input;
 if ('format' in input || 'version' in input || 'data' in input) {
  check(input.format === backupFormat, 'Diese Datei ist keine Sicherung dieser Arbeitszeit-App.');
  check(input.version === backupVersion, 'Diese Sicherungsversion wird nicht unterstützt. Bitte die passende App-Version verwenden.');
  check(typeof input.createdAt === 'string' && Number.isFinite(Date.parse(input.createdAt)), 'Das Sicherungsdatum ist ungültig.');
  raw = input.data;
 }
 check(object(raw) && object(raw.entries) && Array.isArray(raw.planned), 'Die Datei enthält keine vollständigen Tages- und Planungsdaten.');
 const restored = {...JSON.parse(JSON.stringify(defaultData)), ...raw};
 // Keep the selected theme when loading a backup from before the design migration.
 restored.designVersion = 'teal-design-2';
 if('backupFolderHint' in restored)check(typeof restored.backupFolderHint==='string'&&restored.backupFolderHint.length<=240, 'Der Ordnerhinweis in der Sicherung ist ungültig.');
 if('lastBackupCreatedAt' in restored)check(typeof restored.lastBackupCreatedAt==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(restored.lastBackupCreatedAt)&&Number.isFinite(Date.parse(restored.lastBackupCreatedAt)), 'Der Sicherungszeitpunkt in der Datei ist ungültig.');
 check(backupDate(restored.startDate), 'Das Startdatum in der Sicherung ist ungültig.');
 for (const key of ['initialVacation', 'initialTime', 'defaultBreak', 'annualVacation']) {
  check(number(restored[key]), 'Ein Saldo oder Einstellungswert in der Sicherung ist ungültig.');
 }
 check(Number.isInteger(restored.defaultBreak) && restored.defaultBreak >= 0 && restored.defaultBreak <= 600, 'Die Standardpause muss eine ganze Zahl zwischen 0 und 600 Minuten sein.');
 check(restored.annualVacation >= 0, 'Die jährliche Urlaubsgutschrift darf nicht negativ sein.');
 check(['dark', 'light'].includes(restored.theme), 'Die Darstellung in der Sicherung ist ungültig.');
 check(Array.isArray(restored.workplaces) && restored.workplaces.every(v => typeof v === 'string'), 'Die Arbeitsplätze in der Sicherung sind ungültig.');
 check(Array.isArray(restored.customShifts) && restored.customShifts.every(validShift), 'Die eigenen Schichten in der Sicherung sind ungültig.');
 check(object(restored.shifts) && object(restored.shiftDays), 'Die Schichtpläne in der Sicherung sind ungültig.');
 for (const [week, shift] of Object.entries(restored.shifts)) {
  check(!!dateForWeek(week) && validShift(shift), 'Ein Wochen-Schichtplan in der Sicherung ist ungültig.');
 }
 for (const [week, days] of Object.entries(restored.shiftDays)) {
  check(!!dateForWeek(week) && object(days), 'Ein Tages-Schichtplan in der Sicherung ist ungültig.');
  for (const [day, shift] of Object.entries(days)) {
   check(/^[0-6]$/.test(day) && validShift(shift), 'Eine Tagesschicht in der Sicherung ist ungültig.');
  }
 }
 check(object(restored.weekWorkplaces) && Object.entries(restored.weekWorkplaces).every(([week,name])=>!!dateForWeek(week)&&typeof name==='string'), 'Ein Wochen-Arbeitsplatz in der Sicherung ist ungültig.');
 check(restored.planned.every(backupDate), 'Ein geplantes Urlaubsdatum ist ungültig.');
 check(new Set(restored.planned).size === restored.planned.length, 'Die Sicherung enthält doppelte Urlaubsplanungen.');
 check(Array.isArray(restored.credits) && restored.credits.every(c => object(c) && backupDate(c.date) && number(c.days)), 'Eine Urlaubsgutschrift in der Sicherung ist ungültig.');
 for (const [date, entry] of Object.entries(restored.entries)) {
  check(backupDate(date) && object(entry) && ['Arbeit', 'TU', 'ZA', 'KK', 'KU', 'Feiertag', 'Frei'].includes(entry.type), 'Ein gespeicherter Tag in der Sicherung ist ungültig.');
  if (entry.type === 'Arbeit') {
   check(time(entry.start) && time(entry.end), 'Eine Arbeitszeit in der Sicherung ist ungültig.');
  }
  if ('break' in entry) check(number(entry.break) && entry.break >= 0, 'Eine Pause in der Sicherung ist ungültig.');
  if ('payout' in entry) check(['time', 'pay'].includes(entry.payout), 'Eine Überstundenbehandlung in der Sicherung ist ungültig.');
  for(const key of ['payout50','payout100'])if(key in entry)check(['time','pay','split'].includes(entry[key]), 'Eine Überstundenaufteilung in der Sicherung ist ungültig.');
  for (const key of ['override50', 'override100']) {
   if (key in entry) check(entry[key] === null || (number(entry[key]) && entry[key] >= 0), 'Eine manuelle Überstundenkorrektur ist ungültig.');
  }
  for (const key of ['note', 'workplace']) {
   if (key in entry) check(typeof entry[key] === 'string', 'Eine Bemerkung oder ein Arbeitsplatz ist ungültig.');
  }
 }
 return {data: restored, createdAt: raw === input ? null : input.createdAt};
}
function renderLastBackup() {
 renderBackupReminder();
 $('lastBackupFolderHint').textContent = 'Ordnerhinweis: ' + (data.backupFolderHint?.trim() || 'Noch nicht hinterlegt');
 const value=data.lastBackupCreatedAt;
 $('lastBackupCreatedAt').textContent=typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('de-AT',{dateStyle:'medium',timeStyle:'short'}):'Noch kein Zeitpunkt gespeichert';
}
function exportBackup() {
 if (recoveryBusy || backupSharing) return;
 if (typeof File !== 'function') { downloadBackup(); return; }
 shareBackupFile();
}
async function importBackup(event) {
 const input = event.target, file = input.files[0];
 if (!file) return;
 if (recoveryBusy || backupSharing) { input.value = ''; return; }
 const exportButton = $('exportData');
 setBackupBusy(true);
 input.disabled = true;
 exportButton.disabled = true;
 try {
  if (file.size > 20 * 1024 * 1024) throw new Error('Die Datei ist zu groß (maximal 20 MB).');
  let parsed;
  try { parsed = JSON.parse(await file.text()); }
  catch { throw new Error('Die Datei ist keine lesbare JSON-Sicherungsdatei.'); }
  const backup = validateBackup(parsed), restored = backup.data;
  const days = Object.keys(restored.entries).length, weeks = new Set([...Object.keys(restored.shifts), ...Object.keys(restored.shiftDays)]).size;
  const summary = days + ' erfasste Tage, ' + restored.planned.length + ' geplante Urlaubstage, ' + weeks + ' Schichtwochen und alle Einstellungen.';
  const date = backup.createdAt ? '\nErstellt am ' + new Date(backup.createdAt).toLocaleString('de-AT') + '.' : '\nBisheriges Backup-Format.';
  if (!confirm('Sicherung wiederherstellen?\n\n' + summary + date + '\n\nAlle derzeitigen App-Daten werden durch diese Sicherung ersetzt. Möchtest du fortfahren?')) {
   backupMessage('Wiederherstellung abgebrochen. Deine bisherigen Daten bleiben erhalten.');
   return;
  }
  const previous = data, previousStored = localStorage.getItem('arbeitszeit-v3');
  try {
   data = restored;
   // Past plans become booked vacation using the existing application rule.
   realizePastVacation();
   persistAppData(JSON.stringify(data));
   calendarSelection.clear(); calendarMulti=false; calendarDrag=null;
   selected = null;
   month = new Date(today.getFullYear(), today.getMonth(), 1);
   calculationCache = null;
   render();
   fillSettings();
   resetEntry();
   $('planInfo').textContent = '';
   $('shiftInfo').textContent = 'Sicherung wiederhergestellt. ' + $('shiftInfo').textContent;
  } catch (error) {
   data = previous;
   if (localStorage.getItem('arbeitszeit-v3') !== previousStored) {
    if (previousStored === null) localStorage.removeItem('arbeitszeit-v3');
    else persistAppData(previousStored);
   }
   calculationCache = null;
   render();
   fillSettings();
   resetEntry();
   throw new Error('Die Wiederherstellung konnte nicht gespeichert werden. Deine bisherigen Daten bleiben erhalten.');
  }
  $('deleteStatus').hidden = true;
  backupMessage('Sicherung erfolgreich wiederhergestellt: ' + summary, 'success');
 } catch (error) {
  backupMessage(error.message + ' Es wurden keine neuen Daten übernommen.', 'warning');
 } finally {
  input.value = '';
  input.disabled = false;
  exportButton.disabled = false;
  setBackupBusy(false);
 }
}

function showResetDataDialog() {
 if ($('importData').disabled) {
  backupMessage('Bitte die laufende Wiederherstellung zuerst abschließen.', 'warning');
  return;
 }
 $('resetDataError').hidden = true;
 $('confirmResetData').disabled = false;
 $('resetDataDialog').showModal();
}
async function resetAllAppData() {
 let recoveryBeforeReset = null, recoveryRollbackFailed = false;
 try {
  recoveryResetting = true; setBackupBusy(true); $('cancelResetData').disabled = true;
  $('confirmResetData').disabled = true;
  await recoveryQueue;
  // Clear both recovery points and their reminder metadata before resetting the primary record.
  if (window.indexedDB) { recoveryBeforeReset = await recoveryTransaction(); await recoveryTransaction(() => null); }
  localStorage.removeItem('arbeitszeit-v3');
  recoveryState = null;
 } catch {
  if (recoveryBeforeReset) { try { recoveryState = await recoveryTransaction(() => recoveryBeforeReset); } catch { recoveryRollbackFailed = true; } }
  recoveryResetting = false; setBackupBusy(false); $('cancelResetData').disabled = false; $('confirmResetData').disabled = false;
  $('resetDataError').textContent = recoveryRollbackFailed ? 'Die App-Daten konnten nicht gelöscht werden. Die internen Wiederherstellungsstände konnten jedoch nicht erhalten werden. Bitte eine Sicherungsdatei erstellen.' : 'Die Daten konnten nicht gelöscht werden. Deine bisherigen Daten bleiben erhalten. Bitte versuche es erneut.';
  $('resetDataError').hidden = false;
  return;
 }
 $('confirmResetData').disabled = true;
 // Clear unsaved fields as well, before the browser can restore form values.
 document.querySelectorAll('input,textarea').forEach(field => { field.value = field.type === 'file' ? '' : field.defaultValue; });
 document.querySelectorAll('select').forEach(field => { field.selectedIndex = 0; });
 $('resetDataDialog').close();
 // Start with fresh defaults and discard every cached calculation and open draft.
 window.location.reload();
}

function reportRange() {
 const kind=$('reportPeriod').value;
 let from,to,label;
 if(kind==='week') {
  const date=$('reportWeekDate').value;
  if(!backupDate(date)) throw new Error('Bitte ein Datum für die Kalenderwoche auswählen.');
  from=monday(date); to=addDays(from,6); label=weekKey(date).replace('-KW',' · KW ');
 } else if(kind==='month') {
  const value=$('reportMonth').value;
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) throw new Error('Bitte einen gültigen Monat auswählen.');
  const [year,month]=value.split('-').map(Number);
  from=value+'-01'; to=value+'-'+new Date(year,month,0).getDate();
  label=dateObj(from).toLocaleDateString('de-AT',{month:'long',year:'numeric'});
 } else if(kind==='year') {
  const year=$('reportYear').value;
  if(!/^\d{4}$/.test(year)||Number(year)<1900) throw new Error('Bitte ein gültiges Jahr eingeben.');
  from=year+'-01-01'; to=year+'-12-31'; label='Jahr '+year;
 } else if(kind==='range') {
  from=$('reportFrom').value; to=$('reportTo').value; label='Freier Zeitraum';
 } else {
  const dates=[todayStr,data.startDate,...Object.keys(data.entries),...data.planned,...data.credits.map(c=>c.date)].filter(backupDate).sort();
  from=dates[0]; to=dates.at(-1); label='Alle gespeicherten Daten';
 }
 if(!backupDate(from)||!backupDate(to)||to<from) throw new Error('Bitte einen gültigen Zeitraum wählen: Von darf nicht nach Bis liegen.');
 return {from,to,label,kind};
}
function updateReportPeriod() {
 const kind=$('reportPeriod').value;
 for(const name of ['week','month','year','range']) $('reportControls-'+name).hidden=name!==kind;
 try {const range=reportRange();$('reportRangeInfo').textContent=range.label+' · '+formatDate(range.from)+' bis '+formatDate(range.to);}
 catch(error) {$('reportRangeInfo').textContent=error.message;}
 $('reportStatus').hidden=true;
}
function reportMessage(text,warning=false) {
 $('reportStatus').hidden=false;
 $('reportStatus').className='notice '+(warning?'warning':'success');
 $('reportStatus').textContent=text;
}
function reportTimeAt(until,results) {
 const cutoff=until<todayStr?until:todayStr;
 let balance=Number(data.initialTime)||0;
 for(const [date,value] of Object.entries(results)) if(date>=data.startDate&&date<=cutoff) balance+=value.balance||0;
 return round(balance);
}
function buildReport() {
 refreshAppDate(false);
 const range=reportRange(),results=TimeEngine.calculate(data.entries,shiftForDate);
 const dates=new Set([...Object.keys(data.entries),...data.planned,...data.credits.map(c=>c.date)]);
 const annual=new Set(Number(data.annualVacation)?annualDates(range.to):[]);
 for(const date of annual) dates.add(date);
 const names={Arbeit:'Arbeit',TU:'Urlaub',ZA:'Zeitausgleich',KK:'KK – Krankenstand',KU:'KU – Krankstand/Arbeitsunfall',Feiertag:'Feiertag',Frei:'Frei'};
 const rows=[...dates].filter(date=>date>=range.from&&date<=range.to).sort().map(date=>{
  const entry=data.entries[date],detail=results[date]||{},planned=!entry&&data.planned.includes(date);
  const credits=data.credits.filter(c=>c.date===date).reduce((sum,c)=>sum+Number(c.days),0)+(annual.has(date)?Number(data.annualVacation)||0:0);
  const work=entry?.type==='Arbeit',eligible=vacationWorkday(date);
  const status=entry?(date>todayStr?'Erfasst (zukünftig)':'Erfasst'):planned?'Geplant':'Gutschrift';
  const notes=[entry?.note||''];
  if(credits&&entry) notes.push('Urlaubsgutschrift: '+fmt(credits)+' Tage');
  if(detail.error) notes.push('Berechnungsfehler: '+detail.error);
  if(date<data.startDate) notes.push('Vor dem Startdatum der Salden');
  return {date,weekday:dateObj(date).toLocaleDateString('de-AT',{weekday:'short'}),status,
   type:entry?(names[entry.type]||entry.type):planned?'Urlaub geplant':'Urlaubsgutschrift',
   workplace:work?entry.workplace||'':'',start:work?entry.start:'',end:work?entry.end:'',pause:work?entry.break:'',
   worked:detail.worked||0,overtime:detail.overtime||0,h50:detail.h50||0,h100:detail.h100||0,
   payout:work?([50,100].map(category=>category+' %: '+({time:'Zeittopf',pay:'Auszahlung',split:'50:50'}[payoutMode(entry,category)])).join(' · ')):'',credit:detail.credit||0,pay50:detail.pay50||0,pay100:detail.pay100||0,paid:detail.paid||0,
   timeChange:date>=data.startDate&&date<=todayStr?(detail.balance||0):0,
   timeBalance:reportTimeAt(date,results),vacation:entry?.type==='TU'&&eligible?1:0,
   planned:planned&&eligible?1:0,grant:credits,vacationBalance:vacationAt(date),
   holiday:vacationHolidayName(date),note:notes.filter(Boolean).join(' · '),error:detail.error||'',
   za:entry?.type==='ZA'?1:0,kk:entry?.type==='KK'?1:0,ku:entry?.type==='KU'?1:0};
 });
 const total=key=>round(rows.reduce((sum,row)=>sum+(Number(row[key])||0),0));
 const cutoff=range.to<todayStr?range.to:todayStr;
 return {...range,rows,totals:Object.fromEntries(['worked','overtime','h50','h100','credit','timeChange','vacation','planned','za','grant','kk','ku','pay50','pay100','paid'].map(key=>[key,total(key)])),
  cutoff,timeBalance:reportTimeAt(cutoff,results),vacationBalance:vacationAt(cutoff),vacationForecast:vacationAt(range.to),
  errors:rows.filter(row=>row.error).length};
}
function exportReportCsv() {
 try {
  const report=buildReport(),international=$('reportCsvFormat').value==='international',delimiter=international?',':';';
  const cell=value=>{
   let text;
   if(typeof value==='number') text=String(round(value)).replace('.',international?'.':',');
   else {text=String(value??'');if(/^\s*[=+@-]/.test(text))text="'"+text;}
   return '"'+text.replace(/"/g,'""')+'"';
  };
  const headers=['Datum','Wochentag','Status','Tagesart','Arbeitsplatz','Beginn','Ende','Pause (min)','Nettoarbeitszeit (h)','Überstunden gesamt (h)','Überstunden 50 % (h)','Überstunden 100 % (h)','Buchungsart','Zeitgutschrift inkl. Zuschläge (h)','Zeittopf Änderung (h)','Zeittopf Stand (h)','Urlaub erfasst (Tage)','Urlaub geplant (Tage)','Urlaubsgutschrift (Tage)','Urlaubssaldo / Prognose (Tage)','Feiertag / arbeitsfrei','Bemerkung','Berechnungsfehler','Auszahlung 50 % (h ohne Zuschlagsfaktor)','Auszahlung 100 % (h ohne Zuschlagsfaktor)','Auszahlung gesamt (h ohne Zuschlagsfaktor)'];
  const lines=[headers,...report.rows.map(r=>[r.date,r.weekday,r.status,r.type,r.workplace,r.start,r.end,r.pause,r.worked,r.overtime,r.h50,r.h100,r.payout,r.credit,r.timeChange,r.timeBalance,r.vacation,r.planned,r.grant,r.vacationBalance,r.holiday,r.note,r.error,r.pay50,r.pay100,r.paid])];
  const content='\ufeff'+lines.map(row=>row.map(cell).join(delimiter)).join('\r\n')+'\r\n';
  const blob=new Blob([content],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='arbeitszeit-'+report.from+'-bis-'+report.to+'.csv';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  reportMessage('CSV-Datei für '+report.label+' erstellt ('+report.rows.length+' Zeilen).'+(report.errors?' '+report.errors+' Einträge enthalten Berechnungsfehler und sind in der Datei gekennzeichnet.':''),!!report.errors);
 } catch(error) {reportMessage(error.message,true);}
}
function printReport() {
 try {
  const report=buildReport(),h=escapeHtml;
  const rows=report.rows.map(row=>'<tr'+(row.error?' class="report-error"':'')+'><td><b>'+h(formatDate(row.date))+'</b><br>'+h(row.weekday+' · '+row.type)+'<br><small>'+h(row.status)+(row.holiday?'<br>'+h(row.holiday):'')+'</small></td><td>'+h(row.start?row.start+'–'+row.end:'—')+(row.start?'<br><small>'+h(row.pause)+' min Pause'+(row.workplace?'<br>'+h(row.workplace):'')+'</small>':'')+'</td><td class="report-number">'+fmt(row.worked)+'</td><td class="report-number">'+fmt(row.h50)+' / '+fmt(row.h100)+'</td><td>'+h(row.payout||'—')+(row.paid?'<br><small>'+fmt(row.paid)+' h Auszahlung</small>':'')+(row.credit?'<br><small>'+fmt(row.credit)+' h Gutschrift</small>':'')+'</td><td class="report-number">'+fmt(row.timeChange)+'<br><small>Stand '+fmt(row.timeBalance)+' h</small></td><td>'+h(row.vacation?row.vacation+' Tag':row.planned?row.planned+' Tag geplant':'—')+(row.grant?'<br><small>Gutschrift '+fmt(row.grant)+' Tage</small>':'')+'<br><small>Saldo / Prognose '+fmt(row.vacationBalance)+'</small></td><td class="report-note">'+h(row.note||'—')+'</td></tr>').join('');
  $('printReport').innerHTML='<header class="report-heading"><div><h1>Arbeitszeitnachweis</h1><p>'+h(report.label)+' · '+h(formatDate(report.from))+' bis '+h(formatDate(report.to))+'</p></div><span>v'+h(APP_VERSION)+'</span></header>'+
   '<div class="report-totals"><p><b>'+fmt(report.totals.worked)+' h erfasste Arbeitszeit</b> · '+fmt(report.totals.overtime)+' h Überstunden (50 %: '+fmt(report.totals.h50)+' h / 100 %: '+fmt(report.totals.h100)+' h)</p><p>'+fmt(report.totals.vacation)+' Urlaubstage erfasst · '+fmt(report.totals.planned)+' Urlaubstage geplant · '+fmt(report.totals.za)+' Tage Zeitausgleich · '+report.totals.kk+' KK · '+report.totals.ku+' KU</p><p><b>Stand '+h(formatDate(report.cutoff))+':</b> Zeittopf '+fmt(report.timeBalance)+' h · Urlaub '+fmt(report.vacationBalance)+' Tage · <b>Urlaubsprognose bis '+h(formatDate(report.to))+':</b> '+fmt(report.vacationForecast)+' Tage</p></div>'+
   (report.errors?'<p class="report-error-note">'+report.errors+' Einträge mit Berechnungsfehlern. Die betroffenen Stunden sind mit 0 ausgewiesen; bitte die gekennzeichneten Einträge prüfen.</p>':'')+
   '<table class="report-table"><colgroup><col style="width:15%"><col style="width:14%"><col style="width:6%"><col style="width:9%"><col style="width:12%"><col style="width:13%"><col style="width:14%"><col style="width:17%"></colgroup><thead><tr><th>Tag / Tagesart</th><th>Arbeitszeit</th><th>Netto<br>h</th><th>Ü 50 / 100 %<br>h</th><th>Buchung</th><th>Zeittopf +/-<br>h</th><th>Urlaub<br>Tage</th><th>Bemerkung</th></tr></thead><tbody>'+ (rows||'<tr><td colspan="8">Keine gespeicherten Einträge in diesem Zeitraum.</td></tr>')+'</tbody></table>'+
   '<footer class="report-footer">Nettoarbeitszeit ohne Pause; Überstunden ohne Zuschläge. Zeittopf-Stände berücksichtigen gebuchte Einträge ab '+h(formatDate(data.startDate))+' bis spätestens heute. Zukünftige Arbeit ist als solche gekennzeichnet; Urlaubsplanungen fließen in die Prognose ein. Dargestellt sind gespeicherte Einträge, Planungen und Urlaubsgutschriften. Erstellt am '+h(new Date().toLocaleString('de-AT'))+'.</footer>';
  document.body.classList.add('report-preview','printing-report');$('printToolbar').hidden=false;$('printPreviewInfo').textContent=report.label+' · '+formatDate(report.from)+' bis '+formatDate(report.to);window.scrollTo(0,0);$('nativePrint').focus();prepareReportPdf(report);
  reportMessage('Druckansicht für '+report.label+' bereit. Im Druckdialog kannst du drucken oder als PDF sichern.'+(report.errors?' Bitte die markierten Berechnungsfehler prüfen.':''),!!report.errors);
  // The explicit preview button keeps the native print call in a fresh user gesture.
 } catch(error) {document.body.classList.remove('printing-report');reportMessage('Druckansicht konnte nicht erstellt werden. '+error.message,true);}
}
// Excel export stays entirely on the device; OOXML text cells never become formulas.
function excelXml(value) {
 return String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}
function excelColumn(index) {let name='';for(index++;index;index=Math.floor((index-1)/26))name=String.fromCharCode(65+(index-1)%26)+name;return name;}
function excelZip(files) {
 const encode=new TextEncoder(),parts=[],central=[];let offset=0;
 const table=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
 const header=(length,values)=>{const bytes=new Uint8Array(length),v=new DataView(bytes.buffer);for(const [at,size,value] of values)size===2?v.setUint16(at,value,true):v.setUint32(at,value,true);return bytes;};
 for(const [path,text] of files){
  const name=encode.encode(path),bytes=encode.encode(text);let crc=0xffffffff;for(const byte of bytes)crc=table[(crc^byte)&255]^(crc>>>8);crc=(crc^0xffffffff)>>>0;
  const local=header(30,[[0,4,0x04034b50],[4,2,20],[6,2,0x800],[12,2,33],[14,4,crc],[18,4,bytes.length],[22,4,bytes.length],[26,2,name.length]]);
  parts.push(local,name,bytes);
  central.push(header(46,[[0,4,0x02014b50],[4,2,20],[6,2,20],[8,2,0x800],[14,2,33],[16,4,crc],[20,4,bytes.length],[24,4,bytes.length],[28,2,name.length],[42,4,offset]]),name);
  offset+=local.length+name.length+bytes.length;
 }
 const length=central.reduce((n,x)=>n+x.length,0);
 return new Blob([...parts,...central,header(22,[[0,4,0x06054b50],[8,2,files.length],[10,2,files.length],[12,4,length],[16,4,offset]])],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
function excelStyles() {
 const fills=['none','gray125','17343C','DEF3EF','F1F3F5','FFF0C2','FFDCDC'];
 const formats=['General','General','General','0.00;[Red]-0.00','dd.mm.yyyy','hh:mm','[h]:mm','General','General','General','General','0.00;[Red]-0.00'];
 const fill=[0,2,3,0,0,0,0,4,5,6,0,3];
 return '<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="5">'+[[164,formats[3]],[165,formats[4]],[166,formats[5]],[167,formats[6]],[168,'0.##']].map(([id,f])=>'<numFmt numFmtId="'+id+'" formatCode="'+excelXml(f)+'"/>').join('')+'</numFmts><fonts count="3"><font><sz val="11"/><name val="Calibri"/><color rgb="FF17343C"/></font><font><b/><sz val="11"/><name val="Calibri"/><color rgb="FFFFFFFF"/></font><font><b/><sz val="11"/><name val="Calibri"/><color rgb="FF17343C"/></font></fonts><fills count="7">'+fills.map((c,i)=>i<2?'<fill><patternFill patternType="'+c+'"/></fill>':'<fill><patternFill patternType="solid"><fgColor rgb="FF'+c+'"/><bgColor indexed="64"/></patternFill></fill>').join('')+'</fills><borders count="2"><border/><border><bottom style="hair"><color rgb="FFD9E1E5"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="12">'+formats.map((_,i)=>'<xf numFmtId="'+({3:164,4:165,5:166,6:167,11:164}[i]||0)+'" fontId="'+(i===1?1:[2,11].includes(i)?2:0)+'" fillId="'+fill[i]+'" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>').join('')+'</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
}
function excelSheet(rows,widths,merges=[],filterEnd=0) {
 const count=widths.length,last=excelColumn(count-1),cell=(value,r,c)=>{
  const item=value&&typeof value==='object'?value:{v:value},v=item.v,ref=excelColumn(c)+r,s=item.s||0;
  if(item.f)return '<c r="'+ref+'" s="'+s+'"><f>'+excelXml(item.f)+'</f><v>'+Number(v||0)+'</v></c>';
  return typeof v==='number'&&Number.isFinite(v)?'<c r="'+ref+'" s="'+s+'"><v>'+v+'</v></c>':'<c r="'+ref+'" s="'+s+'" t="inlineStr"><is><t xml:space="preserve">'+excelXml(v)+'</t></is></c>';
 };
 return '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:'+last+rows.length+'"/><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="5" topLeftCell="A6" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="19"/><cols>'+widths.map((w,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+w+'" customWidth="1"/>').join('')+'</cols><sheetData>'+rows.map((row,i)=>'<row r="'+(i+1)+'"'+(i===0?' ht="27" customHeight="1"':i===4?' ht="42" customHeight="1"':i>=5&&i<filterEnd?' ht="48" customHeight="1"':'')+'>'+row.map((v,c)=>cell(v,i+1,c)).join('')+'</row>').join('')+'</sheetData>'+(filterEnd?'<autoFilter ref="A5:'+last+filterEnd+'"/>':'')+(merges.length?'<mergeCells count="'+merges.length+'">'+merges.map(ref=>'<mergeCell ref="'+ref+'"/>').join('')+'</mergeCells>':'')+'<printOptions horizontalCentered="1"/><pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/><headerFooter><oddFooter>&amp;LArbeitszeit-App v'+APP_VERSION+'&amp;RSeite &amp;P / &amp;N</oddFooter></headerFooter></worksheet>';
}
function buildExcelReport(report) {
 const months=[],byDate=new Map(report.rows.map(r=>[r.date,r])),results=TimeEngine.calculate(data.entries,shiftForDate);
 for(let key=report.from.slice(0,7);key<=report.to.slice(0,7);){
  if(months.length>=120)throw new Error('Bitte für den Excel-Export einen Zeitraum von höchstens 10 Jahren wählen.');
  const [year,m]=key.split('-').map(Number),first=key+'-01',last=key+'-'+new Date(year,m,0).getDate();
  months.push({key,from:first<report.from?report.from:first,to:last>report.to?report.to:last});
  key=m===12?(year+1)+'-01':year+'-'+String(m+1).padStart(2,'0');
 }
 const number=v=>({v:Number(v)||0,s:3}),serial=date=>Date.UTC(...date.split('-').map((v,i)=>Number(v)-(i===1?1:0)))/86400000+25569;
 const header=values=>values.map(v=>({v,s:1})),sheets=[],summary=[];
 const sum=(rows,key)=>rows.reduce((n,r)=>n+(Number(r[key])||0),0);
 for(const month of months){
  const records=report.rows.filter(r=>r.date>=month.from&&r.date<=month.to),title=dateObj(month.from).toLocaleDateString('de-AT',{month:'long',year:'numeric'}),name=title.replace('Januar','Jänner');
  const rows=[[{v:'Arbeitszeitnachweis · '+name,s:1}],[{v:formatDate(month.from)+' bis '+formatDate(month.to)+' · Erstellt '+new Date().toLocaleDateString('de-AT')+' · v'+APP_VERSION}],[{v:'Stunden als Dezimalzahl; Arbeitszeit zusätzlich in hh:mm. ZA+ enthält Zuschläge. Geplante/zukünftige Werte sind ausdrücklich gekennzeichnet.'}],[],header(['Datum','Tag','FZ / Tagesart','von','bis','Pause min','Arbeitszeit h','Arbeitszeit hh:mm','Ü 50 % h','Ü 100 % h','Ausz. Ü h','ZA+ h','ZA− h','Tätigkeit','Sonstiges / Feiertag','Status','Urlaub Tage','Geplant Tage'])];
  for(let date=month.from;date<=month.to;date=addDays(date,1)){
   const r=byDate.get(date),holiday=vacationHolidayName(date),style=r?.error?9:r?.status.includes('zukünftig')||r?.planned?8:holiday?2:weekend(date)?7:0;
   const code=r?({'Urlaub':'TU','Urlaub geplant':'TU geplant','KK – Krankenstand':'KK','KU – Krankstand/Arbeitsunfall':'KU','Zeitausgleich':'ZA','Feiertag':'FT','Frei':'Frei','Arbeit':''}[r.type]??r.type):holiday?'FT':'';
   const time=v=>v?{v:Number(v.slice(0,2))/24+Number(v.slice(3,5))/1440,s:5}:'';
   rows.push([{v:serial(date),s:4},{v:dateObj(date).toLocaleDateString('de-AT',{weekday:'short'}),s:style},{v:code,s:style},time(r?.start),time(r?.end),r?.pause??'',r?number(r.worked):'',r?{v:r.worked/24,s:6}:'',r?number(r.h50):'',r?number(r.h100):'',r?number(r.paid):'',r?number(Math.max(0,r.timeChange)):'',r?number(Math.max(0,-r.timeChange)):'',{v:r?.workplace||'',s:style},{v:[r?.note,holiday,r?.grant?'Urlaubsgutschrift: '+fmt(r.grant)+' Tage':''].filter(Boolean).join(' · '),s:style},{v:r?.status||'',s:style},r?number(r.vacation):'',r?number(r.planned):'']);
  }
  const end=rows.length,totalsRow=end+1;
  rows.push(Array.from({length:18},(_,i)=>i===0?{v:'Summe',s:2}:[5,6,7,8,9,10,11,12,16,17].includes(i)?{f:'SUM('+excelColumn(i)+'6:'+excelColumn(i)+end+')',v:i===5?sum(records,'pause'):i===7?sum(records,'worked')/24:i===10?sum(records,'paid'):i===11?sum(records.map(r=>({v:Math.max(0,r.timeChange)})),'v'):i===12?sum(records.map(r=>({v:Math.max(0,-r.timeChange)})),'v'):sum(records,({6:'worked',8:'h50',9:'h100',16:'vacation',17:'planned'})[i]),s:i===7?6:11}:{v:'',s:2}));
  const cutoff=month.to<todayStr?month.to:todayStr,before=addDays(month.from,-1),openingTime=reportTimeAt(before,results),closingTime=reportTimeAt(month.to,results);
  rows.push([],['Salden / Urlaub','Wert','Einheit'],['Zeittopf vor Zeitraum',number(openingTime),'h'],['Zeittopf Stand '+formatDate(cutoff),number(closingTime),'h'],['Urlaub vor Zeitraum (inkl. Planung)',number(vacationAt(before)),'Tage'],['Urlaubsgutschriften im Zeitraum',number(sum(records,'grant')),'Tage'],['Urlaub Stand '+formatDate(cutoff),number(vacationAt(cutoff)),'Tage'],['Urlaub Prognose bis '+formatDate(month.to),number(vacationAt(month.to)),'Tage'],[],['Legende: TU = Urlaub · KK = Krankenstand · KU = Krankstand/Arbeitsunfall · ZA = Zeitausgleich · FT = Feiertag/arbeitsfrei'],['Salden ab '+formatDate(data.startDate)+'; Zeittopf nur gebucht bis heute. Die Datei ist ein Exportstand, kein App-Backup.']);
  const balanceMerges=[];
  for(let i=end+2;i<=end+8;i++){
   const [label,value,unit]=rows[i];rows[i]=[{v:label,s:i===end+2?2:0},'','','','',value,unit];
   balanceMerges.push('A'+(i+1)+':E'+(i+1));
  }
  sheets.push({name,xml:excelSheet(rows,[13,7,18,9,9,11,13,15,11,11,12,11,11,24,48,23,13,13],['A1:R1','A2:R2','A3:R3',...balanceMerges,'A'+(rows.length-1)+':R'+(rows.length-1),'A'+rows.length+':R'+rows.length],end)});
  const ref="'"+name.replace(/'/g,"''")+"'!";
  summary.push([{v:name},...['G','I','J','K','L','M','Q','R'].map((c,i)=>({f:ref+c+totalsRow,v:[sum(records,'worked'),sum(records,'h50'),sum(records,'h100'),sum(records,'paid'),sum(records.map(r=>({v:Math.max(0,r.timeChange)})),'v'),sum(records.map(r=>({v:Math.max(0,-r.timeChange)})),'v'),sum(records,'vacation'),sum(records,'planned')][i],s:3})),number(closingTime),number(vacationAt(month.to)),{v:formatDate(cutoff)}]);
 }
 const overview=[[{v:'Jahresübersicht · Arbeitszeiten',s:1}],[{v:formatDate(report.from)+' bis '+formatDate(report.to)+' · v'+APP_VERSION}],[{v:'Summen beziehen sich ausschließlich auf den gewählten Zeitraum. Zeittopf = gebuchter Stand bis Stichtag; Urlaub = Prognose bis Zeitraumende.'}],[],header(['Monat','Arbeitszeit h','Ü 50 % h','Ü 100 % h','Ausz. Ü h','ZA+ h','ZA− h','Urlaub Tage','Geplant Tage','Zeittopf Stand h','Urlaub Prognose Tage','Stichtag Zeittopf']),...summary];
 const last=overview.length;overview.push([{v:'Summe',s:2},...Array.from({length:8},(_,i)=>({f:'SUM('+excelColumn(i+1)+'6:'+excelColumn(i+1)+last+')',v:summary.reduce((n,r)=>n+r[i+1].v,0),s:11})),{v:'Salden werden nicht summiert.',s:2}]);
 overview.push([],['TU = Urlaub · KK = Krankenstand · KU = Krankstand/Arbeitsunfall · ZA = Zeitausgleich · FT = Feiertag/arbeitsfrei'],['Geplant und zukünftig erfasst sind keine bereits geleisteten Stunden. Berechnungsfehler stehen im jeweiligen Monatsblatt.']);
 sheets.unshift({name:'Jahresübersicht',xml:excelSheet(overview,[24,16,14,14,14,13,13,14,14,20,22,19],['A1:L1','A2:L2','A3:L3','J'+(last+1)+':L'+(last+1),'A'+(overview.length-1)+':L'+(overview.length-1),'A'+overview.length+':L'+overview.length],last)});
 const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main',rel='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
 const files=[['[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+sheets.map((_,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')+'</Types>'],['_rels/.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="'+rel+'/officeDocument" Target="xl/workbook.xml"/></Relationships>'],['xl/workbook.xml','<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="'+ns+'" xmlns:r="'+rel+'"><bookViews><workbookView/></bookViews><sheets>'+sheets.map((s,i)=>'<sheet name="'+excelXml(s.name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+'</sheets><definedNames>'+sheets.map((s,i)=>'<definedName name="_xlnm.Print_Titles" localSheetId="'+i+'">'+excelXml("'"+s.name+"'!$1:$5")+'</definedName>').join('')+'</definedNames><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>'],['xl/_rels/workbook.xml.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+sheets.map((_,i)=>'<Relationship Id="rId'+(i+1)+'" Type="'+rel+'/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')+'<Relationship Id="styles" Type="'+rel+'/styles" Target="styles.xml"/></Relationships>'],['xl/styles.xml',excelStyles()],...sheets.map((s,i)=>['xl/worksheets/sheet'+(i+1)+'.xml',s.xml])];
 return excelZip(files);
}
function exportReportExcel() {
 try {
  const report=buildReport(),blob=buildExcelReport(report),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='arbeitszeiten-'+report.from+'-bis-'+report.to+'.xlsx';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  reportMessage('Excel-Datei mit Monatsblättern und Jahresübersicht erstellt.'+(report.errors?' '+report.errors+' Einträge enthalten gekennzeichnete Berechnungsfehler.':''),!!report.errors);
 } catch(error){reportMessage('Excel-Datei konnte nicht erstellt werden. '+error.message,true);}
}

let reportPdfFile=null,reportPdfGeneration=0;
async function prepareReportPdf(report) {
 const generation=++reportPdfGeneration;
 reportPdfFile=null;$('savePdf').disabled=true;$('sharePdf').disabled=true;
 $('pdfStatus').textContent='PDF wird vorbereitet …';
 try {
  if(!window.PDFLib)throw new Error('Die PDF-Datei der App fehlt. Bitte den Ordner vendor mitübernehmen.');
  const {PDFDocument,StandardFonts,rgb}=window.PDFLib;
  const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const supported=new Set(font.getCharacterSet());let replaced=false;
  const plain=value=>Array.from(String(value??'').normalize('NFC')).map(c=>{if(c==='\n'||supported.has(c.codePointAt(0)))return c;if(/\s/.test(c))return ' ';replaced=true;return '?';}).join('');
  const widths=[91,90,45,64,132,69,83,212],xs=[28];for(let i=0;i<widths.length;i++)xs.push(xs[i]+widths[i]);
  const wrap=(value,width,size=8)=>{
   const lines=[];for(const paragraph of plain(value).split('\n')){let line='';for(const word of paragraph.match(/\S+|\s+/g)||[]){if(line&&font.widthOfTextAtSize(line+word,size)>width){lines.push(line.trimEnd());line='';}for(const char of word){if(!line&&/\s/.test(char))continue;if(line&&font.widthOfTextAtSize(line+char,size)>width){lines.push(line);line='';}line+=char;}}lines.push(line.trimEnd());}return lines;
  };
  let page,y,pageNumber=0;
  const text=(value,x,at,size=8,strong=false)=>page.drawText(plain(value),{x,y:at,size,font:strong?bold:font,color:rgb(.09,.17,.19)});
  const header=()=>{page=pdf.addPage([842,595]);pageNumber++;y=550;text('Arbeitszeitnachweis',28,y,18,true);text('v'+APP_VERSION,775,y,10,true);y-=23;text(report.label+' · '+formatDate(report.from)+' bis '+formatDate(report.to),28,y,10);y-=20;
   for(const line of wrap('Arbeitszeit '+fmt(report.totals.worked)+' h · Überstunden 50 %: '+fmt(report.totals.h50)+' h / 100 %: '+fmt(report.totals.h100)+' h · Gutschrift '+fmt(report.totals.credit)+' h · Auszahlung '+fmt(report.totals.paid)+' h',786,9)){text(line,28,y,9);y-=12;}
   text('Zeittopf Stand '+formatDate(report.cutoff)+': '+fmt(report.timeBalance)+' h · KK: '+report.totals.kk+' Tage · KU: '+report.totals.ku+' Tage · Urlaub: '+fmt(report.totals.vacation)+' Tage',28,y,9);y-=23;
   page.drawRectangle({x:28,y:y-6,width:786,height:23,color:rgb(.9,.95,.94)});
   ['Tag / Tagesart','Arbeitszeit','Netto h','Ü 50 / 100 h','Buchung / Auszahlung','Zeittopf +/- h','Urlaub Tage','Bemerkung / Feiertag'].forEach((label,i)=>text(label,xs[i]+4,y,7,true));y-=22;
   text('Seite '+pageNumber+' · Erstellt '+new Date().toLocaleString('de-AT'),28,22,7);
  };
  header();
  const rows=report.rows.length?report.rows:[null];
  for(const row of rows){
   const cells=row?[
    formatDate(row.date)+'\n'+row.weekday+' · '+row.type+'\n'+row.status,
    row.start?row.start+'–'+row.end+'\n'+row.pause+' min Pause\n'+row.workplace:'—',
    fmt(row.worked),fmt(row.h50)+' / '+fmt(row.h100),
    row.payout+(row.paid?'\n'+fmt(row.paid)+' h Auszahlung':'')+(row.credit?'\n'+fmt(row.credit)+' h Gutschrift':''),
    fmt(row.timeChange)+'\nStand '+fmt(row.timeBalance),
    (row.vacation?row.vacation+' Tag':row.planned?row.planned+' geplant':'—')+'\nSaldo '+fmt(row.vacationBalance)+(row.grant?'\nGutschrift '+fmt(row.grant):''),
    [row.note,row.holiday].filter(Boolean).join('\n')||'—'
   ]:['Keine gespeicherten Einträge in diesem Zeitraum.','','','','','','',''];
   let lines=cells.map((cell,i)=>wrap(cell,widths[i]-8)),count=Math.max(...lines.map(l=>l.length)),offset=0;
   if(y- Math.min(count*11+12,180)<46)header();
   while(offset<count){
    let take=Math.min(count-offset,Math.floor((y-46-12)/11));if(take<1){header();continue;}
    const height=take*11+12;
    if(row?.error)page.drawRectangle({x:28,y:y-height+4,width:786,height,color:rgb(1,.95,.91)});
    for(let i=0;i<lines.length;i++)lines[i].slice(offset,offset+take).forEach((line,j)=>text(line,xs[i]+4,y-j*11-4));
    y-=height;page.drawLine({start:{x:28,y:y+4},end:{x:814,y:y+4},thickness:.4,color:rgb(.8,.86,.85)});offset+=take;
    if(offset<count)header();
   }
  }
  const bytes=await pdf.save();
  if(generation!==reportPdfGeneration)return;
  reportPdfFile=new File([bytes],'arbeitszeit-'+report.from+'-bis-'+report.to+'.pdf',{type:'application/pdf'});
  $('savePdf').disabled=false;
  const canShare=typeof navigator.share==='function'&&typeof navigator.canShare==='function'&&navigator.canShare({files:[reportPdfFile]});
  $('sharePdf').hidden=!canShare;$('sharePdf').disabled=!canShare;
  $('pdfStatus').textContent='PDF bereit.'+(replaced?' Einzelne Sonderzeichen sind in der PDF durch ? ersetzt. Für die vollständige Darstellung bitte die Druckansicht verwenden.':'');
 }catch(error){if(generation===reportPdfGeneration)$('pdfStatus').textContent='PDF konnte nicht erstellt werden. '+error.message+' Die Druckansicht bleibt verfügbar.';}
}
function exportReportPdf(share) {
 if(!reportPdfFile){$('pdfStatus').textContent='Bitte warten, bis die PDF bereit ist.';return;}
 if(share){
  // The file is prepared in advance, so sharing retains the button's user activation.
  try{navigator.share({files:[reportPdfFile],title:'Arbeitszeitnachweis'}).then(()=>{$('pdfStatus').textContent='PDF an die Teilenfunktion übergeben.';}).catch(error=>{$('pdfStatus').textContent=error.name==='AbortError'?'Teilen abgebrochen.':'Teilen nicht möglich. Bitte „PDF speichern“ verwenden.';});}
  catch{$('pdfStatus').textContent='Teilen nicht möglich. Bitte „PDF speichern“ verwenden.';}
 }else{
  const url=URL.createObjectURL(reportPdfFile),link=document.createElement('a');link.href=url;link.download=reportPdfFile.name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  $('pdfStatus').textContent='PDF zum Speichern geöffnet. Auf dem iPhone bei Bedarf über „Teilen“ in Dateien sichern oder drucken.';
 }
}

function initReports() {
 $('reportWeekDate').value=todayStr;$('reportMonth').value=todayStr.slice(0,7);$('reportYear').value=today.getFullYear();$('reportFrom').value=todayStr;$('reportTo').value=todayStr;
 $('reportPeriod').onchange=updateReportPeriod;
 for(const id of ['reportWeekDate','reportMonth','reportYear','reportFrom','reportTo']) $(id).addEventListener('input',updateReportPeriod);
 $('exportExcel').onclick=exportReportExcel;$('exportCsv').onclick=exportReportCsv;$('printData').onclick=printReport;
 $('nativePrint').onclick=()=>{try{window.print();}catch(error){$('pdfStatus').textContent='Drucken nicht verfügbar. Bitte PDF speichern oder teilen. '+error.message;}};
 $('closePrintPreview').onclick=()=>{document.body.classList.remove('report-preview','printing-report');$('printToolbar').hidden=true;$('printData').focus();};
 $('savePdf').onclick=()=>exportReportPdf(false);$('sharePdf').onclick=()=>exportReportPdf(true);
 $('sharePdf').hidden=typeof navigator.share!=='function';
 updateReportPeriod();
}

function renderEntryWorkplaces(value=$('entryWorkplace').value) {
 const names=[...new Set([...data.workplaces,...(value?[value]:[])])];
 $('entryWorkplace').innerHTML='<option value="">Kein Arbeitsplatz</option>'+names.map(name=>'<option>'+escapeHtml(name)+'</option>').join('');
 $('entryWorkplace').value=value;
}
function saveAppSettings() {
 const ids=['initialVacation','startDate','initialTime','defaultBreak','annualVacation','theme'];
 for(const id of ids)if(!$(''+id).reportValidity())return;
 const previous=data;
 data={...data,initialVacation:Number($('initialVacation').value),initialTime:Number($('initialTime').value),defaultBreak:Number($('defaultBreak').value),annualVacation:Number($('annualVacation').value),startDate:$('startDate').value,theme:$('theme').value};
 try {save();alert('Einstellungen gespeichert.');}
 catch {data=previous;render();alert('Die Einstellungen konnten nicht gespeichert werden. Deine bisherigen Daten wurden beibehalten.');}
}
// Refresh dates on resume and while the page remains open; preserve deliberate drafts.
function refreshAppDate(redraw=true) {
 const now=new Date(),next=dateISO(now);if(next===todayStr)return;
 const previousDate=todayStr,previousToday=today;
 const pristine=editing===null&&!entryTimesTouched&&$('entryDate').value===previousDate&&$('entryType').value==='Arbeit'&&!$('entryNote').value&&!entryWorkplaceTouched&&!$('entry50').value&&!$('entry100').value&&formPayout(50)==='time'&&formPayout(100)==='time'&&Number($('entryBreak').value)===Number(data.defaultBreak);
 today=now;todayStr=next;
 if(pristine){$('entryDate').value=todayStr;applyEntryShift();applyEntryWorkplace();}
 for(const id of ['creditDate','reportWeekDate','reportFrom','reportTo'])if($(id).value===previousDate)$(id).value=todayStr;
 if($('reportMonth').value===previousDate.slice(0,7))$('reportMonth').value=todayStr.slice(0,7);
 if($('reportYear').value===String(previousToday.getFullYear()))$('reportYear').value=String(today.getFullYear());
 const previousData=data;data={...data,entries:{...data.entries},planned:[...data.planned]};
 let failed=false;
 try {if(realizePastVacation())persistAppData(JSON.stringify(data));}
 catch {data=previousData;failed=true;}
 updateReportPeriod();
 if(redraw)render();
 if(failed)backupMessage('Der Tageswechsel konnte nicht gespeichert werden. Deine bisherigen Daten bleiben erhalten. Bitte erneut laden, sobald Speichern möglich ist.','warning');
}
function initDateRefresh() {
 window.addEventListener('focus',()=>refreshAppDate());
 window.addEventListener('pageshow',()=>refreshAppDate());
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshAppDate();});
 setInterval(()=>{if(!document.hidden)refreshAppDate();},60000);
}

// Offline shell and deliberate updates. User data remains in its existing store.
const pwaDraftKey='arbeitszeit-update-entwurf:'+new URL('.',location.href).pathname;
let pwaRegistration=null,pwaUpdating=false,pwaLastCheck=0,pwaReady=false;
function pwaMessage(text){$('pwaStatus').textContent=text;}
function pwaDetailKey(el){return el.id?'id:'+el.id:'summary:'+(el.querySelector(':scope>summary')?.textContent.trim()||'');}
function capturePwaDraft(){
 const fields=[...document.querySelectorAll('input[id],select[id],textarea[id]')].filter(el=>el.type!=='file').map(el=>({id:el.id,value:el.value,checked:el.checked}));
 const draft={format:1,created:Date.now(),fields,weekdays:[...document.querySelectorAll('[data-plan-weekday]')].map(el=>({value:el.value,checked:el.checked})),editing,entryTimesTouched,entryWorkplaceTouched,selected,calendarMulti,calendarSelection:[...calendarSelection],month:dateISO(month),yearMeasure,yearMonth,tab:document.querySelector('.tabs .active')?.dataset.tab||'overview',scroll:scrollY,openDetails:[...document.querySelectorAll('details')].filter(el=>el.open).map(pwaDetailKey)};
 sessionStorage.setItem(pwaDraftKey,JSON.stringify(draft));
}
function restorePwaDraft(){
 let raw;try{raw=sessionStorage.getItem(pwaDraftKey);if(!raw)return;const draft=JSON.parse(raw);if(draft.format!==1||!Array.isArray(draft.fields)||Date.now()-draft.created>86400000){sessionStorage.removeItem(pwaDraftKey);return;}
  const shiftDate=draft.fields.find(f=>f.id==='shiftDate')?.value;
  if(backupDate(shiftDate)){$('shiftDate').value=shiftDate;loadShiftWeek();}
  editing=draft.editing&&data.entries[draft.editing]?draft.editing:null;
  entryTimesTouched=!!draft.entryTimesTouched;entryWorkplaceTouched=!!draft.entryWorkplaceTouched;
  selected=draft.selected||null;calendarMulti=!!draft.calendarMulti;calendarSelection=new Set((draft.calendarSelection||[]).filter(backupDate));
  if(backupDate(draft.month))month=dateObj(draft.month);
  if(['worked','overtime'].includes(draft.yearMeasure))yearMeasure=draft.yearMeasure;
  if(Number.isInteger(draft.yearMonth)&&draft.yearMonth>=0&&draft.yearMonth<12)yearMonth=draft.yearMonth;
  switchTab(['overview','entry','vacation','year','settings'].includes(draft.tab)?draft.tab:'overview');
  const workplace=draft.fields.find(f=>f.id==='entryWorkplace')?.value;
  if(typeof workplace==='string')renderEntryWorkplaces(workplace);
  for(const field of draft.fields){const el=$(field.id);if(!el||el.type==='file'||typeof field.value!=='string')continue;if(el.tagName==='SELECT'&&!Array.from(el.options).some(o=>o.value===field.value))continue;el.value=field.value;if(el.type==='checkbox'||el.type==='radio')el.checked=!!field.checked;}
  for(const item of draft.weekdays||[]){const el=[...document.querySelectorAll('[data-plan-weekday]')].find(el=>el.value===item.value);if(el)el.checked=!!item.checked;}
  toggleWork();renderEntryShiftHint();renderEntryCalculation();renderCalendar();renderYear();updateReportPeriod();
  document.querySelectorAll('details').forEach(el=>{el.open=(draft.openDetails||[]).includes(pwaDetailKey(el));});
  sessionStorage.removeItem(pwaDraftKey);
  requestAnimationFrame(()=>window.scrollTo(0,Number(draft.scroll)||0));
 }catch{pwaMessage('Dein Entwurf konnte nicht vollständig wiederhergestellt werden. Die gespeicherten Tage bleiben erhalten.');}
}
function showPwaUpdate(){
 $('pwaUpdate').hidden=false;$('applyPwaUpdate').disabled=false;
 $('pwaUpdateText').textContent='Eine neue App-Version ist bereit. Deine offenen Eingaben werden beim Aktualisieren übernommen.';
}
function askWorker(worker,message){return new Promise((resolve,reject)=>{
 if(!worker){reject(Error('Kein Offline-Stand'));return;}
 const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();reject(Error('Keine Antwort'));},4000);
 channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data);};worker.postMessage(message,[channel.port2]);
});}
async function checkPwaReady(){
 try{
  const worker=navigator.serviceWorker.controller||pwaRegistration?.active;
  const result=await askWorker(worker,{type:'OFFLINE_STATUS'});
  pwaReady=!!result.ready&&result.version===APP_VERSION;
  $('offlineSummary').textContent=pwaReady?(navigator.onLine?'Offline bereit':'Offline-Modus'):'Offline noch nicht bereit';
  pwaMessage(pwaReady?'Diese Version ist für Offline-Nutzung bereit. Nach dem ersten vollständigen Laden kannst du die App auch ohne Internet erneut öffnen.':result.ready?'Eine andere App-Version ist bereit. Bitte über den Aktualisieren-Button übernehmen.':'Die Offline-Dateien sind noch nicht vollständig verfügbar. Bitte mit Internet erneut prüfen.');
  if(result.ready&&result.version!==APP_VERSION)showPwaUpdate();
  else if(!pwaRegistration?.waiting&&!pwaUpdating)$('pwaUpdate').hidden=true;
 }catch{pwaReady=false;$('offlineSummary').textContent='Offline noch nicht bereit';pwaMessage(navigator.onLine?'Die Offline-Einrichtung wird vorbereitet. Bitte mit Internet erneut prüfen.':'Diese App-Version ist noch nicht vollständig offline eingerichtet. Bitte mit Internet erneut öffnen.');}
 if(pwaRegistration?.waiting&&pwaRegistration.active)showPwaUpdate();
}
async function checkPwaUpdates(){
 if(!pwaRegistration)return;
 $('checkPwaUpdates').disabled=true;
 try{if(navigator.onLine){await pwaRegistration.update();pwaLastCheck=Date.now();}await checkPwaReady();}
 catch{pwaMessage(pwaReady?'Die vorhandene Version bleibt offline verfügbar. Die Prüfung auf eine neue Version war nicht möglich.':'Die Einrichtung konnte nicht abgeschlossen werden. Bitte Verbindung prüfen und erneut versuchen.');}
 finally{$('checkPwaUpdates').disabled=false;}
}
function applyPwaUpdate(){
 if($('importData').disabled || recoveryBusy || backupSharing){$('pwaUpdateText').textContent='Bitte zuerst die laufende Wiederherstellung abschließen.';return;}
 try{capturePwaDraft();}catch{$('pwaUpdateText').textContent='Offene Eingaben konnten nicht zwischengespeichert werden. Bitte zuerst speichern; die App wurde nicht neu geladen.';return;}
 pwaUpdating=true;$('applyPwaUpdate').disabled=true;$('pwaUpdateText').textContent='Aktualisierung wird übernommen …';
 if(pwaRegistration?.waiting)pwaRegistration.waiting.postMessage({type:'ACTIVATE_UPDATE'});
 else window.location.reload();
}
function initPwa(){
 restorePwaDraft();
 $('applyPwaUpdate').onclick=applyPwaUpdate;$('checkPwaUpdates').onclick=checkPwaUpdates;
 const standalone=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 $('pwaLaunchMode').textContent=standalone?'Vom Home-Bildschirm gestartet':'Im Browser geöffnet';
 if(!('serviceWorker' in navigator)||!window.isSecureContext||location.protocol==='file:'){
  $('offlineSummary').textContent='Offline-Einrichtung noch nicht aktiv';pwaMessage('Die Offline-Einrichtung ist über die veröffentlichte HTTPS-Adresse verfügbar. Die lokale Datei bleibt wie bisher nutzbar.');$('checkPwaUpdates').disabled=true;return;
 }
 $('offlineSummary').textContent='Offline-Einrichtung läuft';
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(pwaUpdating){window.location.reload();return;}checkPwaReady();});
 navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).then(registration=>{
  pwaRegistration=registration;
  if(registration.waiting&&registration.active)showPwaUpdate();
  const watch=()=>{const worker=registration.installing;if(!worker)return;worker.addEventListener('statechange',()=>{if(worker.state==='installed'){if(registration.waiting&&registration.active)showPwaUpdate();checkPwaReady();}if(worker.state==='activated')checkPwaReady();if(worker.state==='redundant')pwaMessage(pwaReady?'Die neue Version konnte noch nicht vollständig geladen werden. Die bisherige Version bleibt verfügbar.':'Die Offline-Dateien konnten noch nicht vollständig geladen werden. Bitte mit Internet erneut prüfen.');});};
  registration.addEventListener('updatefound',watch);watch();checkPwaReady();
 }).catch(()=>{$('offlineSummary').textContent='Offline noch nicht bereit';pwaMessage('Die Offline-Einrichtung konnte nicht gestartet werden. Bitte prüfen, ob alle App-Dateien veröffentlicht sind, und neu laden.');});
 window.addEventListener('offline',checkPwaReady);
 window.addEventListener('online',checkPwaUpdates);
 window.addEventListener('focus',()=>{checkPwaReady();if(navigator.onLine&&Date.now()-pwaLastCheck>60000)checkPwaUpdates();});
}

// Two local recovery points complement, but never replace, external JSON backups.
var recoveryInitialized = false;
let recoveryDBPromise, recoveryQueue = Promise.resolve(), recoveryState = null;
let recoveryResetting = false, recoveryBusy = false, recoveryCapturePending = false;
let recoveryFailure = '', backupSharing = false;
let recoveryCaptureAllowed = false;
const recoveryDBName = 'arbeitszeit-wiederherstellung:' + new URL('.', location.href).pathname;
const backupFileName = 'arbeitszeit-sicherung.json';
function persistAppData(serialized) {
 localStorage.setItem('arbeitszeit-v3', serialized);
 if (recoveryInitialized && !recoveryResetting) { recoveryCaptureAllowed = true; scheduleRecoveryCapture(); }
}
function recoverySignature(value) {
 function stable(v) {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])]));
  return v;
 }
 const copy = {...value}; delete copy.lastBackupCreatedAt;
 return JSON.stringify(stable(copy));
}
function openRecoveryDB() {
 if (recoveryDBPromise) return recoveryDBPromise;
 recoveryDBPromise = new Promise((resolve, reject) => {
  if (!window.indexedDB) { reject(new Error('Lokale Wiederherstellungsstände werden hier nicht unterstützt.')); return; }
  let settled = false, request;
  const fail = () => { if (!settled) { settled = true; clearTimeout(timer); reject(new Error('Der zusätzliche lokale Speicher ist nicht verfügbar.')); } };
  const timer = setTimeout(fail, 5000);
  try { request = indexedDB.open(recoveryDBName, 1); } catch { fail(); return; }
  request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('recovery')) request.result.createObjectStore('recovery'); };
  request.onerror = fail; request.onblocked = fail;
  request.onsuccess = () => {
   if (settled) { request.result.close(); return; }
   settled = true; clearTimeout(timer);
   const db = request.result;
   db.onversionchange = () => { db.close(); recoveryDBPromise = null; };
   resolve(db);
  };
 });
 recoveryDBPromise.catch(() => { recoveryDBPromise = null; });
 return recoveryDBPromise;
}
async function recoveryTransaction(change) {
 const db = await openRecoveryDB();
 return new Promise((resolve, reject) => {
  let result, failure;
  const tx = db.transaction('recovery', change ? 'readwrite' : 'readonly');
  const store = tx.objectStore('recovery'), request = store.get('state');
  request.onsuccess = () => {
   try {
    result = request.result || {current:null, previous:null, exportedSignature:null, dirtySince:null};
    if (change) { result = change(result); if (result === null) store.delete('state'); else store.put(result, 'state'); }
   } catch (error) { failure = error; tx.abort(); }
  };
  tx.oncomplete = () => resolve(result);
  tx.onerror = tx.onabort = () => reject(failure || new Error('Der Wiederherstellungsstand konnte nicht gespeichert werden.'));
 });
}
function enqueueRecovery(action) {
 const task = recoveryQueue.then(action);
 recoveryQueue = task.catch(() => {});
 return task;
}
function showRecoveryFailure(error) {
 recoveryFailure = error.message || 'Der zusätzliche lokale Speicher ist nicht verfügbar.';
 renderRecovery();
}
function scheduleRecoveryCapture() {
 if (recoveryCapturePending || recoveryResetting || !recoveryCaptureAllowed) return;
 recoveryCapturePending = true;
 queueMicrotask(() => {
  recoveryCapturePending = false;
  if (recoveryResetting) return;
  enqueueRecovery(async () => {
   recoveryState = await recoveryTransaction(record => {
    // Read inside the transaction so delayed tasks cannot resurrect an older save or a reset record.
    const json = localStorage.getItem('arbeitszeit-v3');
    if (!json) return null;
    const restored = validateBackup(JSON.parse(json)).data, signature = recoverySignature(restored);
    const previousSignature = record.current ? recoverySignature(JSON.parse(record.current.json)) : null;
    if (previousSignature !== signature) {
     record.previous = record.current;
     record.current = {createdAt:new Date().toISOString(), json:JSON.stringify(restored)};
     if (record.exportedSignature === signature) record.dirtySince = null;
     else if (!record.dirtySince) record.dirtySince = new Date().toISOString();
    } else record.current.json = JSON.stringify(restored);
    return record;
   });
   recoveryFailure = ''; renderRecovery();
  }).catch(showRecoveryFailure);
 });
}
function recoveryDate(value) {
 return new Date(value).toLocaleString('de-AT', {dateStyle:'medium', timeStyle:'short'});
}
function renderRecovery() {
 if (!$('recoveryStatus')) return;
 $('recoveryStatus').textContent = recoveryFailure ? recoveryFailure + ' Die bisherigen App-Daten bleiben davon unberührt. Bitte eine Sicherungsdatei erstellen.' : recoveryState?.current ? 'Interne Wiederherstellungsstände werden nach gespeicherten Änderungen automatisch aktualisiert.' : 'Noch kein interner Wiederherstellungsstand vorhanden.';
 for (const name of ['current','previous']) {
  const point = recoveryState?.[name], label = name === 'current' ? 'Aktueller Stand' : 'Vorheriger Stand';
  $('recovery'+name+'Date').textContent = point ? label + ': ' + recoveryDate(point.createdAt) : label + ': noch nicht vorhanden';
  $('restore'+name).disabled = !point || recoveryBusy || backupSharing || !!recoveryFailure;
 }
 renderBackupReminder();
}
function renderBackupReminder() {
 const notice = $('backupReminder');
 if (!notice) return;
 let overdue = false;
 if (recoveryState?.dirtySince && recoveryState.exportedSignature !== recoverySignature(data)) {
  overdue = Date.now() - Date.parse(recoveryState.dirtySince) >= 7 * 86400000;
 }
 notice.hidden = !overdue;
 $('backupReminderText').textContent = 'Seit mindestens sieben Tagen gibt es Änderungen ohne neu erstellte Sicherungsdatei. Bitte eine Sicherung speichern und die Ablage abschließen.';
}
function setBackupBusy(busy) {
 recoveryBusy = busy;
 for (const id of ['exportData','importData','saveBackupFolder','resetData','checkRecoveryStorage']) $(id).disabled = busy;
 renderRecovery();
}
function backupFolderMessage() {
 const folder = data.backupFolderHint?.trim();
 return folder ? ' Dein Ordnerhinweis: ' + folder + '.' : '';
}
function createBackupPayload() {
 const timestamp = new Date().toISOString();
 const payload = {format:backupFormat, version:backupVersion, createdAt:timestamp, data:{...data, lastBackupCreatedAt:timestamp}};
 validateBackup(payload);
 return payload;
}
function backupBlob(payload) { return new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'}); }
function finishExternalBackup(payload, message) {
 let timestampSaved = true;
 try {
  // A share dialog can stay open while another tab saves data. Do not overwrite those changes.
  const latest = JSON.parse(localStorage.getItem('arbeitszeit-v3') || JSON.stringify(data));
  const updated = {...latest, lastBackupCreatedAt:payload.createdAt};
  persistAppData(JSON.stringify(updated)); data = updated;
 } catch { timestampSaved = false; }
 renderLastBackup();
 backupMessage(message + backupFolderMessage() + ' Die dauerhafte Ablage der Datei bitte selbst prüfen.' + (timestampSaved ? '' : ' Der Zeitpunkt konnte nicht dauerhaft in der App gespeichert werden; die bisherige Anzeige bleibt erhalten.'), timestampSaved ? 'success' : 'warning');
 const signature = recoverySignature(payload.data);
 enqueueRecovery(async () => {
  recoveryState = await recoveryTransaction(record => {
   record.exportedSignature = signature;
   record.dirtySince = recoverySignature(data) === signature ? null : (record.dirtySince || new Date().toISOString());
   return record;
  });
  recoveryFailure = ''; renderRecovery();
 }).catch(showRecoveryFailure);
}
function downloadBackup() {
 let url;
 try {
  const payload = createBackupPayload();
  url = URL.createObjectURL(backupBlob(payload));
  const link = document.createElement('a'); link.href = url; link.download = backupFileName;
  document.body.appendChild(link); link.click(); link.remove();
  const downloadURL = url; setTimeout(() => URL.revokeObjectURL(downloadURL), 60000);
  finishExternalBackup(payload, 'Sicherungsdatei erstellt: ' + backupFileName + '. Bitte den Download abschließen.');
 } catch (error) {
  if (url) URL.revokeObjectURL(url);
  backupMessage('Sicherung konnte nicht erstellt werden. ' + error.message, 'warning');
 }
}
function shareBackupFile() {
 if (recoveryBusy || backupSharing) return;
 try {
  const payload = createBackupPayload(), file = new File([backupBlob(payload)], backupFileName, {type:'application/json'});
  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function' || !navigator.canShare({files:[file]})) {
   downloadBackup(); return;
  }
  // Call directly during the tap, before awaiting any asynchronous operation.
  const result = navigator.share({files:[file], title:'Arbeitszeit-Sicherung'});
  backupSharing = true; setBackupBusy(true);
  Promise.resolve(result).then(() => finishExternalBackup(payload, 'Sicherungsdatei an die Teilenfunktion übergeben. Unter „In Dateien sichern“ den gewünschten Ordner wählen.')).catch(error => {
   if (error.name === 'AbortError') backupMessage('Teilen abgebrochen. Der Sicherungszeitpunkt bleibt unverändert.');
   else downloadBackup();
  }).finally(() => { backupSharing = false; setBackupBusy(false); });
 } catch (error) {
  if (error.name === 'AbortError') backupMessage('Teilen abgebrochen. Der Sicherungszeitpunkt bleibt unverändert.');
  else downloadBackup();
 }
}
function saveBackupFolder() {
 const value = $('backupFolderHint').value.trim();
 if (value.length > 240) { backupMessage('Der Ordnerhinweis darf höchstens 240 Zeichen enthalten.', 'warning'); return; }
 const previous = data;
 try {
  data = {...data, backupFolderHint:value}; persistAppData(JSON.stringify(data)); renderLastBackup();
  backupMessage(value ? 'Ordnerhinweis gespeichert. Beim Sichern den Ordner selbst unter „Dateien“ auswählen.' : 'Ordnerhinweis entfernt.', 'success');
 } catch { data = previous; backupMessage('Der Ordnerhinweis konnte nicht gespeichert werden.', 'warning'); }
}
async function restoreRecoveryPoint(name) {
 if (recoveryBusy || $('importData').disabled) return;
 setBackupBusy(true);
 try {
  await Promise.resolve(); await recoveryQueue;
  const state = await recoveryTransaction(), point = state[name];
  if (!point) throw new Error('Dieser Wiederherstellungsstand ist nicht mehr verfügbar.');
  const restored = validateBackup(JSON.parse(point.json)).data;
  if (!confirm('Internen Stand vom ' + recoveryDate(point.createdAt) + ' wiederherstellen?\n\n' + Object.keys(restored.entries).length + ' erfasste Tage und alle Einstellungen. Die aktuellen App-Daten werden ersetzt.')) return;
  const previous = data, previousStored = localStorage.getItem('arbeitszeit-v3');
  try {
   data = restored; realizePastVacation(); persistAppData(JSON.stringify(data));
   refreshRestoredData();
  } catch (error) {
   data = previous;
   if (previousStored === null) localStorage.removeItem('arbeitszeit-v3'); else persistAppData(previousStored);
   refreshRestoredData(); throw error;
  }
  backupMessage('Interner Stand vom ' + recoveryDate(point.createdAt) + ' wiederhergestellt. Bitte bei Bedarf zusätzlich eine Sicherungsdatei erstellen.', 'success');
 } catch (error) { backupMessage('Wiederherstellung nicht möglich. ' + error.message, 'warning'); }
 finally { setBackupBusy(false); }
}
function refreshRestoredData() {
 calendarSelection.clear(); calendarMulti = false; calendarDrag = null; selected = null;
 month = new Date(today.getFullYear(), today.getMonth(), 1); calculationCache = null;
 render(); fillSettings(); resetEntry(); $('planInfo').textContent = ''; $('deleteStatus').hidden = true;
}
async function checkRecoveryStorage() {
 if (recoveryBusy) return;
 $('checkRecoveryStorage').disabled = true;
 try {
  await recoveryQueue; recoveryState = await recoveryTransaction(); recoveryFailure = ''; renderRecovery();
  scheduleRecoveryCapture();
 } catch (error) { showRecoveryFailure(error); }
 finally { $('checkRecoveryStorage').disabled = false; }
}
function initRecovery() {
 recoveryInitialized = true;
 recoveryCaptureAllowed = primaryWasPresent && !primaryLoadFailed;
 $('saveBackupFolder').onclick = saveBackupFolder;
 $('restorecurrent').onclick = () => restoreRecoveryPoint('current');
 $('restoreprevious').onclick = () => restoreRecoveryPoint('previous');
 $('checkRecoveryStorage').onclick = checkRecoveryStorage;
 $('resetDataDialog').addEventListener('cancel', event => { if (recoveryResetting) event.preventDefault(); });
 $('openBackupReminder').onclick = () => { switchTab('settings'); $('backupCard').open = true; $('backupCard').scrollIntoView({block:'start'}); };
 enqueueRecovery(async () => { recoveryState = await recoveryTransaction(); renderRecovery(); }).catch(showRecoveryFailure);
 if (primaryWasPresent && !primaryLoadFailed) scheduleRecoveryCapture();
 window.addEventListener('focus', () => { if (!recoveryBusy && !recoveryResetting) checkRecoveryStorage(); });
 window.addEventListener('storage', event => {
  if (event.key === 'arbeitszeit-v3') {
   // Read the shared primary record for snapshots, without discarding this tab's open forms.
   if (event.newValue !== null) { recoveryCaptureAllowed = true; scheduleRecoveryCapture(); }
   else { recoveryState = null; renderRecovery(); }
  }
 });
}

function fillSettings(){for(let k of ['initialVacation','initialTime','defaultBreak','annualVacation','startDate','theme'])$(k).value=data[k];$('shiftDate').dispatchEvent(new Event('change'));$('backupFolderHint').value=data.backupFolderHint||''}init();initDateRefresh();initPwa();initRecovery()})();
