
(()=>{'use strict';const $=id=>document.getElementById(id),today=new Date(),dateISO=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,todayStr=dateISO(today),dateObj=s=>new Date(s+'T12:00:00'),addDays=(s,n)=>{let d=dateObj(s);d.setDate(d.getDate()+n);return dateISO(d)},round=n=>Math.round(n*100)/100,fmt=n=>`${Number(round(n)).toLocaleString('de-AT',{maximumFractionDigits:2})}`,formatDate=s=>dateObj(s).toLocaleDateString('de-AT'),weekend=s=>[0,6].includes(dateObj(s).getDay()),defaultData={startDate:todayStr,initialVacation:0,initialTime:0,defaultBreak:18,annualVacation:25,theme:'dark',workplaces:[],shifts:{},shiftDays:{},customShifts:[],entries:{},planned:[],credits:[]};let data;try{data={...defaultData,...JSON.parse(localStorage.getItem('arbeitszeit-v3')||'{}')}}catch{data={...defaultData}};data.entries=data.entries||{};data.planned=data.planned||[];data.credits=data.credits||[];data.shifts=data.shifts||{};data.shiftDays=data.shiftDays||{};data.customShifts=Array.isArray(data.customShifts)?data.customShifts:[];data.workplaces=data.workplaces||[];if(data.designVersion!=='teal-design-2'){data.theme='dark';data.designVersion='teal-design-2';localStorage.setItem('arbeitszeit-v3',JSON.stringify(data));}let selected=null,month=new Date(today.getFullYear(),today.getMonth(),1),editing=null,entryTimesTouched=false;function save(){realizePastVacation();localStorage.setItem('arbeitszeit-v3',JSON.stringify(data));render()}
function realizePastVacation(){let changed=false;data.planned=data.planned.filter(d=>{if(d>todayStr)return true;let e=data.entries[d];if(e&&e.type!=='TU')return true;if(!e)data.entries[d]={type:'TU'};changed=true;return false});return changed}
function enterVacationDays(dates){let recorded=0,planned=0,existing=0,conflicts=[];for(let d of dates){if(weekend(d))continue;let e=data.entries[d];if(e){if(e.type==='TU')existing++;else conflicts.push(d);continue}if(d<=todayStr){data.entries[d]={type:'TU'};data.planned=data.planned.filter(x=>x!==d);recorded++}else if(!data.planned.includes(d)){data.planned.push(d);planned++}else existing++;}save();let parts=[];if(recorded)parts.push(recorded+' Urlaubstage als TU erfasst');if(planned)parts.push(planned+' Urlaubstage eingeplant');if(existing)parts.push(existing+' Tage bereits vorhanden');if(conflicts.length)parts.push(conflicts.length+' Tage mit bestehenden Einträgen übersprungen: '+conflicts.map(formatDate).join(', '));$('planInfo').innerHTML='<div class="notice '+(conflicts.length?'warning':'')+'">'+(parts.join('. ')||'Keine zusätzlichen Urlaubstage im ausgewählten Zeitraum.')+'.</div>';}
function annualDates(until){let out=[];for(let y=dateObj(data.startDate).getFullYear();y<=dateObj(until).getFullYear();y++){let d=`${y}-04-01`;if(d>data.startDate&&d<=until)out.push(d)}return out}function vacationAt(until){let n=Number(data.initialVacation)||0;if(until<data.startDate)return n;for(let d of annualDates(until))n+=Number(data.annualVacation)||0;for(let c of data.credits)if(c.date>=data.startDate&&c.date<=until)n+=Number(c.days)||0;for(let [date,e] of Object.entries(data.entries))if(date>=data.startDate&&date<=until&&e.type==='TU')n--;for(let d of data.planned)if(d>=data.startDate&&d<=until&&!data.entries[d])n--;return n}function futureApril(){let y=today.getFullYear();return todayStr<`${y}-04-01`?`${y}-04-01`:`${y+1}-04-01`}function forecastEnd(){let ds=[todayStr,futureApril(),...data.planned.filter(d=>d>=todayStr),...Object.keys(data.entries).filter(d=>d>=todayStr&&data.entries[d].type==='TU')];return ds.sort().at(-1)}function warnings(){let current=vacationAt(todayStr);if(current<0)return `⚠️ Aktuell fehlen ${fmt(-current)} Urlaubstage. Der eingetragene Urlaub bleibt gespeichert.`;let ds=[...new Set([...data.planned,...Object.keys(data.entries).filter(d=>data.entries[d].type==='TU')])].filter(d=>d>=todayStr).sort();let first=ds.find(d=>vacationAt(d)<0);return first?`⚠️ Am ${formatDate(first)} fehlen voraussichtlich ${fmt(-vacationAt(first))} Urlaubstage. Die Planung bleibt trotzdem gespeichert.`:''}function weekKey(s){let d=dateObj(s),dow=(d.getDay()+6)%7;d.setDate(d.getDate()-dow+3);let y=d.getFullYear(),jan4=new Date(y,0,4,12);let wd=(jan4.getDay()+6)%7;jan4.setDate(jan4.getDate()-wd+3);return `${y}-KW${String(1+Math.round((d-jan4)/604800000)).padStart(2,'0')}`}
const standardShifts=['05:30-13:30','06:00-14:00','13:30-21:30','14:00-22:00','18:00-02:00','21:30-05:30','22:00-06:00'],dayNames=['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'];
function validShift(s){return typeof s==='string'&&/^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/.test(s)&&s.slice(0,5)!==s.slice(6)}
function monday(s){return addDays(s,-((dateObj(s).getDay()+6)%7))}
function dateForWeek(k){let match=/^(\d{4})-KW(\d{2})$/.exec(k);if(!match)return null;let s=monday(match[1]+'-01-04');s=addDays(s,(Number(match[2])-1)*7);return weekKey(s)===k?s:null}
function shiftForDate(s){let k=weekKey(s),day=(dateObj(s).getDay()+6)%7,override=data.shiftDays[k]?.[day];return validShift(override)?override:validShift(data.shifts[k])?data.shifts[k]:'06:00-14:00'}
function shiftOptions(){let all=[...standardShifts,...data.customShifts,...Object.values(data.shifts),...Object.values(data.shiftDays).flatMap(d=>Object.values(d||{}))];return [...new Set(all.filter(validShift))].map(s=>'<option value="'+s+'">'+s.replace('-','–')+(standardShifts.includes(s)?'':' · Eigene Schicht')+'</option>').join('')}
function renderShiftList(){let keys=[...new Set([...Object.keys(data.shifts),...Object.keys(data.shiftDays)])].filter(k=>dateForWeek(k)).sort().reverse();$('shiftList').innerHTML=keys.map(k=>{let m=dateForWeek(k),n=Object.values(data.shiftDays[k]||{}).filter(validShift).length;return '<div class="item"><span><b>'+k.replace('-KW',' · KW ')+'</b><br><small>'+formatDate(m)+'–'+formatDate(addDays(m,6))+'<br>'+escapeHtml((data.shifts[k]||'06:00-14:00').replace('-','–'))+(n?' · '+n+' angepasste Tage':' · gesamte Woche')+'</small></span><button type="button" class="secondary" data-editshift="'+k+'">Bearbeiten</button></div>'}).join('')||'<p class="muted">Noch keine Wochen gespeichert.</p>'}
function loadShiftWeek(){let s=$('shiftDate').value,ok=!!s;$('saveShift').disabled=!ok;$('shiftPrev').disabled=!ok;$('shiftNext').disabled=!ok;if(!ok){$('shiftWeekLabel').textContent='Woche auswählen';$('shiftRange').textContent='';$('shiftInfo').textContent='Bitte ein Datum auswählen.';return}let k=weekKey(s),m=monday(s);$('shiftWeekLabel').textContent=k.replace('-KW',' · KW ');$('shiftRange').textContent=formatDate(m)+' bis '+formatDate(addDays(m,6))+' · Montag bis Sonntag';$('shiftSelect').innerHTML=shiftOptions();$('shiftSelect').value=data.shifts[k]||'06:00-14:00';$('shiftDayFields').innerHTML=dayNames.map((name,i)=>'<label for="shiftDay'+i+'">'+name+' · '+formatDate(addDays(m,i))+'</label><select id="shiftDay'+i+'"><option value="">Wochenschicht übernehmen</option>'+shiftOptions()+'</select>').join('');for(let i=0;i<7;i++)$('shiftDay'+i).value=data.shiftDays[k]?.[i]||'';$('shiftInfo').textContent=data.shifts[k]||data.shiftDays[k]?'Gespeicherter Wochenplan – Änderungen mit „Wochenplan speichern“ übernehmen.':'Für diese Woche ist noch kein Plan gespeichert.';renderShiftList()}
function renderEntryShiftHint(){let s=$('entryDate').value;if(!s)return;$('entryShiftHint').textContent=weekKey(s).replace('-KW',' · KW ')+' · Schicht '+shiftForDate(s).replace('-','–')+' · '+(editing?'Gespeicherte Arbeitszeiten werden beibehalten.':'Vorgabe aus dem Wochenplan; Uhrzeiten sind frei anpassbar.')}
function applyEntryShift(){let s=$('entryDate').value;if(s&&editing===null){let [start,end]=shiftForDate(s).split('-');$('entryStart').value=start;$('entryEnd').value=end;entryTimesTouched=false}renderEntryShiftHint()}
function hours(s,e){let [sh,sm]=s.split(':').map(Number),[eh,em]=e.split(':').map(Number);let v=(eh*60+em)-(sh*60+sm);return v<0?v+1440:v}const TimeEngine=(()=>{// Pure minute arithmetic for the replacement calculation. Business rules are
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
  const day=Math.floor(minute/DAY),clock=minute-day*DAY,weekday=dow(day),date=dayDate(day),week=weekStart(day),previous=weeks.get(week)||0;
  const boundaries=[item.end,(day+1)*DAY,day*DAY+360,day*DAY+1320,r.scheduled[0],r.scheduled[1],minute+(600-elapsed),minute+(720-elapsed),minute+(3000-previous),...r.overtimeRanges.flatMap(([a,b])=>[a,b])];
  const end=Math.min(...boundaries.filter(n=>n>minute)),length=end-minute;
  weeks.set(week,previous+length);
  const before=minute<r.scheduled[0],after=minute>=r.scheduled[1],sunday=weekday===0,holiday=!!holidayName(date),saturday=weekday===6,daily=elapsed>=600&&elapsed<720;
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
  const credit=r.entry.payout==='pay'?0:h50*1.5+h100*2;
  results[r.date]={worked:r.workedMinutes/60,h50,h100,overtime:h50+h100,credit,balance:credit-r.shortfall/60,auto50:r.auto50/60,auto100:r.auto100/60,shortfall:r.shortfall/60,segments:r.segments,overridden:!r.shortfall&&(override(r.entry.override50)||override(r.entry.override100))};
 }
 return {...results,...errorResults};
}
return {minutes,span,overlap,merge,subtract,duration,intersection,dailyWindows,splitDays,dateDay,dayDate,holidayName,holidays,prepare,calculate};
})();let calculationCache=null;
function workDetails(e,date){if(!calculationCache)calculationCache=TimeEngine.calculate(data.entries,shiftForDate);return calculationCache[date]||{worked:0,h50:0,h100:0,overtime:0,credit:0,balance:0,segments:[],shortfall:0}}
function draftEntry(){return {type:$('entryType').value,start:$('entryStart').value,end:$('entryEnd').value,break:Number($('entryBreak').value),payout:$('entryPayout').value,override50:$('entry50').value===''?null:Number($('entry50').value),override100:$('entry100').value===''?null:Number($('entry100').value)}}
function minuteLabel(n,entryDate){let day=Math.floor(n/1440),clock=n-day*1440,date=TimeEngine.dayDate(day);return String(Math.floor(clock/60)).padStart(2,'0')+':'+String(clock%60).padStart(2,'0')+(date===entryDate?'':' ('+formatDate(date)+')')}
function renderEntryCalculation(){let panel=$('entryCalculation'),date=$('entryDate').value;panel.hidden=$('entryType').value!=='Arbeit';if(panel.hidden)return;if(!date||!$('entryStart').value||!$('entryEnd').value){panel.textContent='Datum, Beginn und Ende eingeben.';return}let entries={...data.entries};if(editing&&editing!==date)delete entries[editing];entries[date]=draftEntry();let result=TimeEngine.calculate(entries,shiftForDate)[date];if(result.error){panel.textContent=result.error;return}const paid=$('entryPayout').value==='pay';panel.innerHTML='<h4 class="calculation-heading">Berechnung für diesen Tag</h4><div class="calculation-grid"><div><span class="mini">Nettoarbeitszeit</span><strong>'+fmt(result.worked)+' h</strong></div><div><span class="mini">Überstunden gesamt</span><strong>'+fmt(result.overtime)+' h</strong></div><div><span class="mini">Überstunden 50 %</span><strong>'+fmt(result.h50)+' h</strong></div><div><span class="mini">Überstunden 100 %</span><strong>'+fmt(result.h100)+' h</strong></div></div><div class="calculation-amount">'+(paid?'Zur Auszahlung: <b>'+fmt(result.h50)+' h mit 50 % · '+fmt(result.h100)+' h mit 100 %</b>':'Zeitgutschrift inkl. Zuschlägen: <b>'+fmt(result.credit)+' h</b>')+'</div>'+(result.shortfall?'<div class="calculation-amount">Fehlende Normalarbeitszeit: <b>−'+fmt(result.shortfall)+' h aus dem Zeittopf</b></div>':'')+'<div class="mini" style="margin-top:8px">'+(result.overridden?'Manuelle Überschreibung aktiv. Automatisch: '+fmt(result.auto50)+' h mit 50 %, '+fmt(result.auto100)+' h mit 100 %.':result.shortfall?'Manuelle Überstundenwerte werden unter 7 h 42 min nicht gebucht.':'Automatisch nach deinen Regeln berechnet.')+'</div><details style="margin-top:10px"><summary style="min-height:44px;padding:10px 0;cursor:pointer">Zeitabschnitte &amp; Zuschläge</summary>'+result.segments.map(s=>'<div class="calculation-segment"><b>'+minuteLabel(s.start,date)+'–'+minuteLabel(s.end,date)+' · '+fmt((s.end-s.start)/60)+' h'+(s.rate?' · '+s.rate+' %':'')+'</b><span>'+escapeHtml(s.reason)+'</span></div>').join('')+'</details>'}
function calc(e,date){return workDetails(e,date).balance}function monthlySummary(){let totals={pay50:0,pay100:0,credit:0,worked:0,overtime:0};for(let [d,e] of Object.entries(data.entries)){if(!d.startsWith(todayStr.slice(0,7))||d>todayStr||e.type!=='Arbeit')continue;let detail=workDetails(e,d);totals.worked+=detail.worked;totals.overtime+=detail.overtime;if(e.payout==='pay'){totals.pay50+=detail.h50;totals.pay100+=detail.h100}else totals.credit+=detail.credit;}return totals}function renderMonthlySummary(){let totals=monthlySummary();$('summaryMonth').textContent=today.toLocaleDateString('de-AT',{month:'long',year:'numeric'});for(let [id,key] of Object.entries({monthPay100:'pay100',monthPay50:'pay50',monthTimeCredit:'credit',monthWorked:'worked',monthOvertime:'overtime'}))$(id).textContent=fmt(totals[key])+' h';}function timeBalance(){let n=Number(data.initialTime)||0;for(let [d,e] of Object.entries(data.entries))if(d>=data.startDate&&d<=todayStr)n+=calc(e,d);return round(n)}function switchTab(id){document.querySelectorAll('main section').forEach(s=>s.hidden=s.id!==id);document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));$('heading').textContent={overview:'Übersicht',entry:'Zeiterfassung',vacation:'Urlaubsplanung',year:'Jahresübersicht',settings:'Einstellungen'}[id];render()}function render(){calculationCache=null;document.body.classList.toggle('dark',data.theme==='dark');document.documentElement.style.colorScheme=data.theme==='dark'?'dark':'light';document.querySelector('meta[name="theme-color"]').content=data.theme==='dark'?'#0e1417':'#eef4f3';renderMonthlySummary();$('today').textContent=today.toLocaleDateString('de-AT',{weekday:'long',day:'numeric',month:'long',year:'numeric'});$('balance').textContent=fmt(timeBalance())+' h';$('vacCurrent').textContent=fmt(vacationAt(todayStr))+' Tage';$('vacApril').textContent=`Am ${formatDate(futureApril())}: ${fmt(vacationAt(futureApril()))} Tage`;$('vacAfter').textContent=`Nach allen Planungen: ${fmt(vacationAt(forecastEnd()))} Tage`;$('overviewWarning').innerHTML=(warnings()?`<div class="notice warning">${warnings()}</div>`:'')+Object.entries(calculationCache||{}).filter(([,r])=>r.error).map(([d,r])=>'<div class="notice warning">'+formatDate(d)+': '+escapeHtml(r.error)+' Dieser Eintrag wird bis zur Korrektur nicht berechnet.</div>').join('');let entries=Object.entries(data.entries).sort((a,b)=>b[0].localeCompare(a[0]));$('recent').innerHTML=entries.slice(0,4).map(([d,e])=>`<div class="recorded-entry-row"><button type="button" class="recent-entry" data-edit="${d}" aria-label="Tag ${formatDate(d)} bearbeiten"><span class="recent-date"><span class="icon-badge"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18"/></svg></span>${formatDate(d)}</span><span class="recent-time">${e.type==='Arbeit'?e.start+'–'+e.end:escapeHtml(e.type)}</span><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button>${entryDeleteButton(d)}</div>`).join('')||'<p class="muted">Noch keine Tage erfasst.</p>';$('entryList').innerHTML=entries.slice(0,50).map(([d,e])=>`<div class="item"><span class="entry-list-text">${formatDate(d)} · ${escapeHtml(e.type)}<br><small>${e.type==='Arbeit'?e.start+'–'+e.end+' · '+e.break+' min Pause':''}</small></span><div class="entry-actions"><button type="button" class="secondary" data-edit="${d}">Bearbeiten</button>${entryDeleteButton(d)}</div></div>`).join('')||'<p class="muted">Keine Einträge.</p>';$('entryWorkplace').innerHTML='<option value="">Kein Arbeitsplatz</option>'+data.workplaces.map(w=>`<option>${escapeHtml(w)}</option>`).join('');renderCalendar();$('planCurrent').textContent=fmt(vacationAt(todayStr))+' Tage';$('planApril').textContent=fmt(vacationAt(futureApril()))+' Tage';$('aprilLabel').textContent='Am '+formatDate(futureApril());$('planAfter').textContent=fmt(vacationAt(forecastEnd()))+' Tage';$('vacWarnings').innerHTML=warnings()?`<div class="notice warning">${warnings()}</div>`:'<div class="notice success">✓ Für die derzeit geplanten Urlaubstage ist ausreichend Urlaub verfügbar.</div>';renderYear();renderWorkplaces();renderCredits();renderShiftList();renderEntryShiftHint();renderEntryCalculation()}function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}function renderCalendar(){let y=month.getFullYear(),m=month.getMonth();$('monthLabel').textContent=month.toLocaleDateString('de-AT',{month:'long',year:'numeric'});let first=(new Date(y,m,1).getDay()+6)%7,count=new Date(y,m+1,0).getDate();let html=['Mo','Di','Mi','Do','Fr','Sa','So'].map(w=>`<div class="weekday">${w}</div>`).join('');for(let i=0;i<first;i++)html+='<div class="day empty"></div>';for(let d=1;d<=count;d++){let s=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`,used=data.entries[s]?.type==='TU',planned=data.planned.includes(s);html+=`<button type="button" data-day="${s}" class="day ${used?'used':planned?'plan':''} ${selected===s?'selected':''}">${d}${used?'<span class="dot">Urlaub</span>':planned?'<span class="dot">Plan</span>':''}</button>`}$('calendar').innerHTML=html;$('chosenDate').textContent=selected?`${formatDate(selected)} · ${data.entries[selected]?.type==='TU'?'Bereits als Urlaub erfasst':data.entries[selected]?'Bereits erfasst: '+escapeHtml(data.entries[selected].type):data.planned.includes(selected)?'Urlaub geplant':'Noch nicht geplant'}`:'Wähle einen Tag im Kalender.';$('planSelected').textContent=selected&&selected<=todayStr?'Urlaub erfassen':'Tag planen';$('planSelected').disabled=!selected||weekend(selected)||data.planned.includes(selected)||!!data.entries[selected];$('removeSelected').disabled=!selected||!data.planned.includes(selected)}
let yearMeasure='worked',yearMonth=today.getMonth();
const yearMonthNames=['Jänner','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
function yearEntriesFor(y){return Object.entries(data.entries).filter(([d])=>d.startsWith(y+'-')).sort((a,b)=>b[0].localeCompare(a[0]))}
function yearMonthTotals(entries){let months=Array.from({length:12},()=>({worked:0,overtime:0,days:0,work:0,vacation:0,za:0,sick:0}));for(let [d,e] of entries){let m=Number(d.slice(5,7))-1;if(m<0||m>11)continue;let value=months[m],detail=workDetails(e,d);value.days++;value.worked+=detail.worked;value.overtime+=detail.overtime;if(e.type==='Arbeit')value.work++;if(e.type==='TU')value.vacation++;if(e.type==='ZA')value.za++;if(e.type==='KK')value.sick++;}return months}
function chooseYearMonth(){let y=$('yearSelect').value,entries=yearEntriesFor(y);yearMonth=y===String(today.getFullYear())?today.getMonth():entries.length?Number(entries[0][0].slice(5,7))-1:0;renderYear()}
function renderYear(){
let y=$('yearSelect').value||String(today.getFullYear());
for(let savedYear of [...new Set(Object.keys(data.entries).map(d=>d.slice(0,4)))].filter(y=>/^\d{4}$/.test(y))){if(!Array.from($('yearSelect').options).some(o=>o.value===savedYear))$('yearSelect').add(new Option(savedYear,savedYear));}
let entries=yearEntriesFor(y),months=yearMonthTotals(entries),sum=key=>months.reduce((n,m)=>n+m[key],0);
$('yearTotalLabel').textContent='Arbeitsstunden · '+y;$('yearTotalWorked').textContent=fmt(sum('worked'))+' h';$('yearTotalOvertime').textContent=fmt(sum('overtime'))+' h Überstunden im Jahr';
$('yearStats').innerHTML=[['Arbeitstage','work'],['Urlaubstage','vacation'],['Zeitausgleich','za'],['Krankenstand','sick']].map(([label,key])=>'<div class="year-stat"><strong>'+sum(key)+'</strong><span>'+label+'</span></div>').join('');
for(let b of document.querySelectorAll('[data-year-measure]'))b.setAttribute('aria-pressed',String(b.dataset.yearMeasure===yearMeasure));
let peak=Math.max(0,...months.map(m=>m[yearMeasure])),step=peak>100?20:peak>20?10:peak>5?5:1,max=Math.max(step,Math.ceil(peak/step)*step);
$('yearBars').innerHTML=months.map((m,i)=>'<button type="button" class="year-bar-row '+(m.days?'':'no-entries')+'" data-year-month="'+i+'" aria-pressed="'+(i===yearMonth)+'" aria-label="'+yearMonthNames[i]+' '+y+': '+(m.days?fmt(m[yearMeasure])+' Stunden '+(yearMeasure==='worked'?'Arbeitszeit':'Überstunden'):'keine Einträge')+'"><span class="year-bar-month">'+yearMonthNames[i].slice(0,3)+'</span><span class="year-bar-track" aria-hidden="true"><span class="year-bar-fill" style="width:'+Math.max(0,Math.min(100,m[yearMeasure]/max*100))+'%"></span></span><span class="year-bar-value">'+(m.days?fmt(m[yearMeasure])+' h':'—')+'</span></button>').join('');
$('yearAxisMax').textContent=fmt(max)+' h';let m=months[yearMonth],monthEntries=entries.filter(([d])=>Number(d.slice(5,7))-1===yearMonth),title=yearMonthNames[yearMonth]+' '+y;
$('yearMonthSummary').innerHTML='<strong>'+title+'</strong>'+(m.days?'<span>'+fmt(m.worked)+' h Arbeitszeit · '+fmt(m.overtime)+' h Überstunden</span><span>'+m.work+' Arbeitstage · '+m.vacation+' Urlaub · '+m.za+' ZA · '+m.sick+' Krankenstand</span>':'<span>Noch keine Einträge für diesen Monat.</span>');
$('yearEntriesHeading').textContent=yearMonthNames[yearMonth]+' · erfasst';$('yearEntryCount').textContent=m.days+' '+(m.days===1?'Tag':'Tage');
const names={Arbeit:'Arbeit',TU:'Urlaub',ZA:'Zeitausgleich',KK:'Krankenstand',Feiertag:'Feiertag',Frei:'Frei'};
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
 const names = {Arbeit:'Arbeit', TU:'Urlaub', ZA:'Zeitausgleich', KK:'Krankenstand', Feiertag:'Feiertag', Frei:'Frei'};
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
  localStorage.setItem('arbeitszeit-v3', JSON.stringify(data));
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
  else localStorage.setItem('arbeitszeit-v3', previousStored);
  render();
  alert('Der Tag konnte nicht gelöscht werden. Deine bisherigen Daten bleiben erhalten.');
  return;
 }
 const status = $('deleteStatus');
 status.textContent = formatDate(date) + ' · ' + kind + ' gelöscht. Die Salden wurden aktualisiert.';
 status.hidden = false;
}

function resetEntry(){editing=null;$('entryForm').reset();$('entryDate').value=todayStr;$('entryBreak').value=data.defaultBreak;$('entryInfo').hidden=true;toggleWork();applyEntryShift();renderEntryCalculation()}function toggleWork(){$('workFields').hidden=$('entryType').value!=='Arbeit';renderEntryShiftHint();renderEntryCalculation()}function editEntry(d){let e=data.entries[d];if(!e)return;editing=d;$('entryDate').value=d;$('entryType').value=e.type;$('entryStart').value=e.start||'06:00';$('entryEnd').value=e.end||'14:00';$('entryBreak').value=e.break??data.defaultBreak;$('entryPayout').value=e.payout||'time';$('entry50').value=e.override50??'';$('entry100').value=e.override100??'';$('entryNote').value=e.note||'';toggleWork();switchTab('entry');$('entryWorkplace').value=e.workplace||'';window.scrollTo(0,0)}function init(){$('resetData').onclick=showResetDataDialog;$('cancelResetData').onclick=()=>$('resetDataDialog').close();$('confirmResetData').onclick=resetAllAppData;if(realizePastVacation())localStorage.setItem('arbeitszeit-v3',JSON.stringify(data));document.querySelectorAll('.tabs button').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));$('entryType').onchange=toggleWork;$('entryReset').onclick=resetEntry;$('entryForm').onsubmit=e=>{e.preventDefault();let d=$('entryDate').value,type=$('entryType').value;if(!d)return;let item={type,start:$('entryStart').value,end:$('entryEnd').value,break:Number($('entryBreak').value),payout:$('entryPayout').value,override50:$('entry50').value===''?null:Number($('entry50').value),override100:$('entry100').value===''?null:Number($('entry100').value),note:$('entryNote').value,workplace:$('entryWorkplace').value};if(type==='Arbeit'){let entries={...data.entries};if(editing&&editing!==d)delete entries[editing];entries[d]=item;let result=TimeEngine.calculate(entries,shiftForDate)[d];if(result.error){alert(result.error);return}if([item.override50,item.override100].some(v=>v!==null&&(!Number.isFinite(v)||v<0))){alert('Bitte gültige Überstundenwerte eingeben.');return}} if(editing&&editing!==d)delete data.entries[editing];data.entries[d]=item;if(type==='TU')data.planned=data.planned.filter(x=>x!==d);save();$('entryInfo').hidden=false;$('entryInfo').textContent='Tag gespeichert. Du kannst ihn unten erneut bearbeiten.';editing=d;renderEntryCalculation()};$('recent').onclick=entryListAction;$('entryList').onclick=entryListAction;$('monthPrev').onclick=()=>{month.setMonth(month.getMonth()-1);selected=null;renderCalendar()};$('monthNext').onclick=()=>{month.setMonth(month.getMonth()+1);selected=null;renderCalendar()};$('calendar').onclick=e=>{let b=e.target.closest('[data-day]');if(b){selected=b.dataset.day;renderCalendar()}};$('planSelected').onclick=()=>{if(selected&&!weekend(selected))enterVacationDays([selected])};
$('removeSelected').onclick=()=>{data.planned=data.planned.filter(x=>x!==selected);save()};
$('planRange').onclick=()=>{let a=$('planFrom').value,b=$('planTo').value;if(!a||!b||b<a){$('planInfo').innerHTML='<div class="notice warning">Bitte einen gültigen Zeitraum wählen.</div>';return}let dates=[];for(let d=a;d<=b;d=addDays(d,1)){if(dates.length===370){$('planInfo').innerHTML='<div class="notice warning">Bitte einen Zeitraum von maximal 370 Tagen auswählen.</div>';return}dates.push(d)}enterVacationDays(dates)};
for(let y=today.getFullYear()-3;y<=today.getFullYear()+5;y++)$('yearSelect').add(new Option(String(y),String(y)));$('yearSelect').value=String(today.getFullYear());$('yearSelect').onchange=chooseYearMonth;
document.querySelectorAll('[data-year-measure]').forEach(b=>b.onclick=()=>{yearMeasure=b.dataset.yearMeasure;renderYear()});
$('yearBars').onclick=e=>{let b=e.target.closest('[data-year-month]');if(b){yearMonth=Number(b.dataset.yearMonth);renderYear()}};
$('yearEntries').onclick=entryListAction;$('saveSettings').onclick=()=>{data.initialVacation=Number($('initialVacation').value);data.initialTime=Number($('initialTime').value);data.defaultBreak=Math.max(0,Number($('defaultBreak').value));data.annualVacation=Math.max(0,Number($('annualVacation').value));data.startDate=$('startDate').value||todayStr;data.theme=$('theme').value;save();alert('Einstellungen gespeichert.')};$('addWorkplace').onclick=()=>{let s=$('newWorkplace').value.trim();if(s&&!data.workplaces.includes(s)){data.workplaces.push(s);$('newWorkplace').value='';save()}};$('workplaceList').onclick=e=>{let b=e.target.closest('button');if(!b)return;if(b.dataset.rename!==undefined){let i=Number(b.dataset.rename),v=prompt('Arbeitsplatz bearbeiten',data.workplaces[i]);if(v?.trim()){data.workplaces[i]=v.trim();save()}}if(b.dataset.deletework!==undefined){data.workplaces.splice(Number(b.dataset.deletework),1);save()}};$('shiftDate').onchange=loadShiftWeek;
$('shiftPrev').onclick=()=>{$('shiftDate').value=addDays($('shiftDate').value,-7);loadShiftWeek()};
$('shiftNext').onclick=()=>{$('shiftDate').value=addDays($('shiftDate').value,7);loadShiftWeek()};
$('saveShift').onclick=()=>{let s=$('shiftDate').value;if(!s){loadShiftWeek();return}let k=weekKey(s),shift=$('shiftSelect').value;if(!validShift(shift))return;data.shifts[k]=shift;let days={};for(let i=0;i<7;i++){let v=$('shiftDay'+i).value;if(validShift(v))days[i]=v}if(Object.keys(days).length)data.shiftDays[k]=days;else delete data.shiftDays[k];save();$('shiftInfo').textContent=k.replace('-KW',' · KW ')+' gespeichert. Die Zeiterfassung übernimmt die Schichten für neue Einträge.';if(editing===null&&!entryTimesTouched){applyEntryShift();renderEntryCalculation()}};
$('shiftList').onclick=e=>{let b=e.target.closest('[data-editshift]');if(b){$('shiftDate').value=dateForWeek(b.dataset.editshift);loadShiftWeek();$('shiftCard').scrollIntoView({block:'start',behavior:'smooth'})}};
$('addCustomShift').onclick=()=>{let s=$('customShiftStart').value+'-'+$('customShiftEnd').value;if(!validShift(s)){$('customShiftInfo').textContent='Bitte gültige, unterschiedliche Uhrzeiten eingeben.';return}if(!standardShifts.includes(s)&&!data.customShifts.includes(s))data.customShifts.push(s);let selected=$('shiftSelect').value,days=dayNames.map((_,i)=>$('shiftDay'+i)?.value||'');$('shiftSelect').innerHTML=shiftOptions();$('shiftSelect').value=s;for(let i=0;i<7;i++){let el=$('shiftDay'+i);if(el){el.innerHTML='<option value="">Wochenschicht übernehmen</option>'+shiftOptions();el.value=days[i]}}save();$('customShiftInfo').textContent='Schicht '+s.replace('-','–')+' hinzugefügt und ausgewählt. Mit „Wochenplan speichern“ zuweisen.'};
$('entryDate').onchange=()=>{let s=$('entryDate').value;if(!s)return;if(data.entries[s]){editEntry(s);return}editing=null;$('entryInfo').hidden=true;applyEntryShift();renderEntryCalculation()};
for(let id of ['entryStart','entryEnd'])$(id).oninput=()=>{entryTimesTouched=true;renderEntryCalculation()};for(let id of ['entryBreak','entryPayout','entry50','entry100'])$(id).addEventListener('input',renderEntryCalculation);
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
 check(backupDate(restored.startDate), 'Das Startdatum in der Sicherung ist ungültig.');
 for (const key of ['initialVacation', 'initialTime', 'defaultBreak', 'annualVacation']) {
  check(number(restored[key]), 'Ein Saldo oder Einstellungswert in der Sicherung ist ungültig.');
 }
 check(restored.defaultBreak >= 0 && restored.annualVacation >= 0, 'Pause und jährliche Urlaubsgutschrift dürfen nicht negativ sein.');
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
 check(restored.planned.every(backupDate), 'Ein geplantes Urlaubsdatum ist ungültig.');
 check(new Set(restored.planned).size === restored.planned.length, 'Die Sicherung enthält doppelte Urlaubsplanungen.');
 check(Array.isArray(restored.credits) && restored.credits.every(c => object(c) && backupDate(c.date) && number(c.days)), 'Eine Urlaubsgutschrift in der Sicherung ist ungültig.');
 for (const [date, entry] of Object.entries(restored.entries)) {
  check(backupDate(date) && object(entry) && ['Arbeit', 'TU', 'ZA', 'KK', 'Feiertag', 'Frei'].includes(entry.type), 'Ein gespeicherter Tag in der Sicherung ist ungültig.');
  if (entry.type === 'Arbeit') {
   check(time(entry.start) && time(entry.end), 'Eine Arbeitszeit in der Sicherung ist ungültig.');
  }
  if ('break' in entry) check(number(entry.break) && entry.break >= 0, 'Eine Pause in der Sicherung ist ungültig.');
  if ('payout' in entry) check(['time', 'pay'].includes(entry.payout), 'Eine Überstundenbehandlung in der Sicherung ist ungültig.');
  for (const key of ['override50', 'override100']) {
   if (key in entry) check(entry[key] === null || (number(entry[key]) && entry[key] >= 0), 'Eine manuelle Überstundenkorrektur ist ungültig.');
  }
  for (const key of ['note', 'workplace']) {
   if (key in entry) check(typeof entry[key] === 'string', 'Eine Bemerkung oder ein Arbeitsplatz ist ungültig.');
  }
 }
 return {data: restored, createdAt: raw === input ? null : input.createdAt};
}
function exportBackup() {
 let url;
 try {
  const createdAt = new Date();
  const payload = {format: backupFormat, version: backupVersion, createdAt: createdAt.toISOString(), data};
  validateBackup(payload);
  const stamp = dateISO(createdAt) + '-' + [createdAt.getHours(), createdAt.getMinutes(), createdAt.getSeconds()].map(v => String(v).padStart(2, '0')).join('');
  const filename = 'arbeitszeit-backup-' + stamp + '.json';
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type: 'application/json'});
  url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  const downloadUrl = url;
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 60000);
  backupMessage('Sicherungsdatei erstellt: ' + filename + '. Bitte den Download abschließen und die Datei aufbewahren. Auf dem iPhone kannst du sie in „Dateien“ oder iCloud Drive ablegen.', 'success');
 } catch (error) {
  if (url) URL.revokeObjectURL(url);
  backupMessage('Sicherung konnte nicht erstellt werden. ' + error.message, 'warning');
 }
}
async function importBackup(event) {
 const input = event.target, file = input.files[0];
 if (!file) return;
 const exportButton = $('exportData');
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
   localStorage.setItem('arbeitszeit-v3', JSON.stringify(data));
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
    else localStorage.setItem('arbeitszeit-v3', previousStored);
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
function resetAllAppData() {
 try {
  // Only this app's complete data record; other apps on the same host stay intact.
  localStorage.removeItem('arbeitszeit-v3');
 } catch {
  $('resetDataError').textContent = 'Die Daten konnten nicht gelöscht werden. Deine bisherigen Daten bleiben erhalten. Bitte versuche es erneut.';
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

function fillSettings(){for(let k of ['initialVacation','initialTime','defaultBreak','annualVacation','startDate','theme'])$(k).value=data[k];$('shiftDate').dispatchEvent(new Event('change'))}init()})();
