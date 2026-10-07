// Ladle & Spoon: Lia's admin screens (S-034, v276). Loaded by index.html (loadAdmin) only
// when the Admin tab opens or on a phone signed in as admin, so customers' phones never
// download or run it. Same global scope as index.html: its functions and variables are
// shared both ways. index.html calls into this file only after adminReady().
var ADMIN_JS_VERSION = 'v276';

// Phone photos are 3–6 MB. Shrink to at most 1600px and re-encode as JPEG in the browser
// before uploading, so Cloudinary never stores a full-size original. Resolves to the
// original file whenever shrinking isn't possible or wouldn't help (e.g. a browser that
// can't decode HEIC), so an upload is never blocked by this step.
function shrinkPhoto(file, maxDim) {
  maxDim = maxDim || 1600;
  return new Promise(function(resolve){
    if (!file || !/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type || '')) return resolve(file);
    var src = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function(){
      URL.revokeObjectURL(src);
      var scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
      if (scale === 1 && file.size < 500 * 1024) return resolve(file);   // already small
      var c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * scale);
      c.height = Math.round(img.naturalHeight * scale);
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);   // PNG transparency → white, not black
      ctx.drawImage(img, 0, 0, c.width, c.height);                      // browsers apply EXIF rotation here
      c.toBlob(function(blob){
        if (!blob || blob.size >= file.size) return resolve(file);
        resolve(new File([blob], (file.name || 'photo').replace(/\.[^.]*$/, '') + '.jpg', { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.85);
    };
    img.onerror = function(){ URL.revokeObjectURL(src); resolve(file); };
    img.src = src;
  });
}

// ═══════════════ GIFT CERTIFICATES — ADMIN ═══════════════
// Lia's side. The only action that matters is Confirm: it is what turns a PENDING
// certificate into a spendable one and sends it to the recipient, and it exists
// because a Venmo payment cannot be seen by the app.
function buildGiftAdmin(){
  var el=$('gift-admin'); if(!el) return;
  el.innerHTML='<div style="font-size:12px;color:var(--t3)">Loading…</div>';
  fetch(APPS_SCRIPT_URL+'?type=get_gift_certs')
    .then(function(r){ return r.json(); })
    .catch(function(){ return null; })
    .then(function(d){
      if(!d || !d.success){ el.innerHTML='<div style="font-size:12px;color:var(--t3)">Could not load.</div>'; return; }
      var certs=d.certs||[];
      if(!certs.length){ el.innerHTML='<div style="font-size:12px;color:var(--t3)">No gift certificates yet.</div>'; return; }
      var pending=certs.filter(function(x){ return (x.status||'').toUpperCase()==='PENDING'; });
      var active =certs.filter(function(x){ return (x.status||'').toUpperCase()==='ACTIVE'; });
      var done   =certs.filter(function(x){ var s=(x.status||'').toUpperCase(); return s==='USED'||s==='VOID'; });
      var outstanding = active.reduce(function(s,x){ return s+(parseFloat(x.balance)||0); },0);

      var html='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin-bottom:14px">'
        + stat(pending.length,'Awaiting payment', pending.length?'var(--cl)':'var(--t3)')
        + stat(active.length,'Active')
        + stat('$'+outstanding.toFixed(0),'Still to redeem')
        + '</div>';

      if(pending.length){
        html += '<div style="font-size:12px;font-weight:700;color:var(--t2);margin:4px 0 6px">Waiting on payment</div>'
          + '<div style="font-size:11px;color:var(--t3);margin-bottom:8px">Check Venmo for the code in the note, then press Confirm — that is what sends the certificate to them.</div>'
          + pending.map(function(x){ return card(x,true); }).join('');
      }
      if(active.length){
        html += '<div style="font-size:12px;font-weight:700;color:var(--t2);margin:14px 0 6px">Active</div>'
          + active.map(function(x){ return card(x,false); }).join('');
      }
      if(done.length){
        html += '<div style="font-size:12px;font-weight:700;color:var(--t2);margin:14px 0 6px">Finished</div>'
          + done.map(function(x){ return card(x,false); }).join('');
      }
      el.innerHTML=html;

      function stat(v,l,col){
        return '<div style="background:#fafafa;border-radius:10px;padding:11px;text-align:center">'
          + '<div style="font-size:20px;font-weight:900;color:'+(col||'var(--f)')+'">'+v+'</div>'
          + '<div style="font-size:11px;font-weight:700;color:var(--t2);margin-top:2px">'+l+'</div></div>';
      }
      function card(x,isPending){
        var s=(x.status||'').toUpperCase();
        var bg = isPending?'#fff8e1' : (s==='ACTIVE'?'#f0faf0':'#fafafa');
        return '<div style="background:'+bg+';border-radius:10px;padding:11px;margin-bottom:7px">'
          + '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap">'
          +   '<span style="font-family:monospace;font-size:13px;font-weight:700;color:var(--f)">'+x.code+'</span>'
          +   '<span style="font-size:13px;font-weight:700">$'+(parseFloat(x.amount)||0).toFixed(2)
          +     (s==='ACTIVE'&&x.balance<x.amount?' <span style="font-size:11px;color:var(--t3)">($'+(parseFloat(x.balance)||0).toFixed(2)+' left)</span>':'')
          +   '</span></div>'
          + '<div style="font-size:11px;color:var(--t2);margin-top:4px">'
          // S-028 (v270): the buyer typed these, so they are escaped like the Orders screen (S-024).
          +   'From <strong>'+esc(x.buyer||'—')+'</strong> for <strong>'+esc(x.recipient||'—')+'</strong>'
          +   '<br><span style="color:var(--t3)">'+esc(x.recipientEmail||'')+(x.purchased?' · '+esc(x.purchased):'')+'</span>'
          // S-029: the day the buyer chose, and whether it has gone out.
          +   (x.sendOnLabel ? '<br><span class="gift-sendon" style="color:var(--am);font-weight:700">📅 '
                + (x.sent ? 'Sent '+esc(x.sent) : (isPending ? 'They want it sent on ' : 'Sends on ')+esc(x.sendOnLabel)+(isPending ? '' : ', 8 am')) + '</span>' : '')
          + '</div>'
          + (isPending
              ? '<div style="display:flex;gap:6px;margin-top:8px">'
                + '<button onclick="confirmGift(\''+x.code+'\')" style="flex:1;padding:7px;border-radius:8px;border:none;background:var(--f);color:#fff;font-size:11px;font-weight:700;cursor:pointer">✓ Confirm payment &amp; send</button>'
                + '<button onclick="voidGift(\''+x.code+'\')" style="padding:7px 11px;border-radius:8px;border:1.5px solid var(--bd);background:transparent;color:var(--t3);font-size:11px;font-weight:700;cursor:pointer">Void</button></div>'
              : (s==='ACTIVE' ? '<div style="margin-top:7px"><button onclick="voidGift(\''+x.code+'\')" style="padding:5px 10px;border-radius:8px;border:1.5px solid var(--bd);background:transparent;color:var(--t3);font-size:11px;font-weight:700;cursor:pointer">Void</button></div>' : ''))
          + '</div>';
      }
    });
}

function confirmGift(code){
  if(!confirm('Confirm the Venmo payment for '+code+'?\n\nThis sends the certificate to the recipient straight away (or on the day the buyer chose).')) return;
  toast('Sending…');
  fetch(APPS_SCRIPT_URL,{method:'POST',headers:{'Content-Type':'text/plain'},
    body:JSON.stringify({type:'activate_gift_cert',code:code})})
  .then(function(r){ return r.json(); })
  .then(function(d){
    if(d&&d.success&&d.scheduled) toast('🎁 Confirmed. It goes to them on '+(d.sendOnLabel||d.sendOn));
    else if(d&&d.success) toast('🎁 Sent to the recipient');
    else toast((d&&d.error)||'Could not confirm');
    buildGiftAdmin();
  }).catch(function(){ toast('Network error'); });
}

function voidGift(code){
  if(!confirm('Void '+code+'?\n\nIt will stop working immediately. Use this if a payment never arrived, or was refunded.')) return;
  fetch(APPS_SCRIPT_URL,{method:'POST',headers:{'Content-Type':'text/plain'},
    body:JSON.stringify({type:'void_gift_cert',code:code})})
  .then(function(r){ return r.json(); })
  .then(function(){ toast('Voided'); buildGiftAdmin(); })
  .catch(function(){ toast('Network error'); });
}

// Acquisition report. Deliberately shows the reorder rate beside the headcount: a
// channel that brings ten people who never come back is worth less than one bringing
// four regulars, and headcount alone hides that.
function buildAcquisition(){
  var el=$('acq-report'); if(!el) return;
  el.innerHTML='<div style="font-size:12px;color:var(--t3)">Loading…</div>';
  fetch(APPS_SCRIPT_URL+'?type=get_acquisition')
    .then(function(r){ return r.json(); })
    .catch(function(){ return null; })
    .then(function(d){
      if(!d||!d.success){ el.innerHTML='<div style="font-size:12px;color:var(--t3)">Could not load.</div>'; return; }
      if(!d.total){ el.innerHTML='<div style="font-size:12px;color:var(--t3)">No data yet — this fills in as new customers order.</div>'; return; }
      var LBL={nextdoor:'Nextdoor',fbgroup:'Facebook group',fbpage:'Facebook page',google:'Google',
               flyer:'Flyer',email:'Email',text:'Text',friend:'Friend / neighbor',
               instagram:'Instagram',other:'Somewhere else',asked:'Answered, no link',unknown:'Unknown'};
      var max=0; d.sources.forEach(function(s){ if(s.customers>max) max=s.customers; });
      var html='<div style="font-size:12px;color:var(--t2);margin-bottom:10px"><strong>'+d.total+'</strong> customers tracked since this started</div>';
      html += d.sources.map(function(s){
        var w = max?Math.round(s.customers/max*100):0;
        var rateCol = s.repeatRate>=50?'var(--f)':(s.repeatRate>=25?'#84cc16':'var(--t3)');
        return '<div style="margin-bottom:9px">'
          + '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px">'
          +   '<span style="color:var(--t2);font-weight:600">'+(LBL[s.source]||s.source)+'</span>'
          +   '<span style="color:var(--t3)">'+s.customers+(s.last30?' · '+s.last30+' new this month':'')+'</span></div>'
          + '<div style="background:#eee;border-radius:999px;height:6px"><div style="background:var(--f);height:6px;border-radius:999px;width:'+w+'%"></div></div>'
          + '<div style="font-size:11px;color:'+rateCol+';margin-top:2px">'+s.repeatRate+'% ordered again · '+s.avgOrders+' orders each</div>'
          + '</div>';
      }).join('');
      if(d.people && d.people.length){
        html += '<div style="font-size:12px;font-weight:700;color:var(--t2);margin:14px 0 6px">Most recent</div>'
          + d.people.slice(0,12).map(function(m){
              return '<div style="font-size:11px;color:var(--t2);padding:3px 0;display:flex;justify-content:space-between;gap:8px">'
                + '<span>'+(m.name||m.email)+'</span>'
                + '<span style="color:var(--t3);white-space:nowrap">'+(LBL[m.source]||m.source)+' · '+m.first+'</span></div>';
            }).join('');
      }
      el.innerHTML=html;
    });
}

// ═══════════════ RECAPTURE ═══════════════
// Sends to lapsed regulars and — the part that matters — records who was contacted so
// their next order can be matched back. A campaign without that link cannot be judged.
function sendRecapture(){
  var campaign = prompt('Name this campaign (so its results stay separate from later ones):', 'Anniversary');
  if(campaign === null) return;
  campaign = (campaign||'').trim() || 'Anniversary';
  fetch(APPS_SCRIPT_URL,{method:'POST',headers:{'Content-Type':'text/plain'},
    body:JSON.stringify({type:'send_recapture', campaign:campaign, dryRun:true})})
  .then(function(r){ return r.json(); })
  .then(function(d){
    if(!d||!d.success){ toast('Could not check: '+((d&&d.error)||'unknown')); return; }
    if(d.sent===0 && d.skipped>0){
      alert('No room in today\'s email quota.\n\n'+d.skipped+' people are waiting, but the reminder blast has '
        + 'already used most of today\'s allowance. Send this on a day with no scheduled blast — Wednesday is '
        + 'usually clear (menu is live, orders still open).');
      return;
    }
    if(d.sent===0){ toast('Nobody new to contact — everyone eligible has had this campaign.'); return; }
    var msg = 'Send the "'+campaign+'" recapture email to '+d.sent+' lapsed customer'+(d.sent===1?'':'s')+'?'
      + '\n\nThey ordered at least twice but nothing in the last 8 weeks.'
      + (d.skipped ? '\n\n'+d.skipped+' more will wait until tomorrow to stay within the daily email limit.' : '')
      + '\n\nOrders from them in the next 30 days will be credited to this campaign.';
    if(!confirm(msg)) return;
    toast('Sending…');
    fetch(APPS_SCRIPT_URL,{method:'POST',headers:{'Content-Type':'text/plain'},
      body:JSON.stringify({type:'send_recapture', campaign:campaign})})
    .then(function(r){ return r.json(); })
    .then(function(res){
      if(res&&res.success){ toast('📧 Contacted '+res.sent); buildRecapture(); }
      else toast('Send failed: '+((res&&res.error)||'unknown'));
    }).catch(function(){ toast('Network error — nothing sent'); });
  }).catch(function(){ toast('Network error'); });
}

function buildRecapture(){
  var el=$('recap-results'); if(!el) return;
  el.innerHTML='<div style="font-size:12px;color:var(--t3)">Loading…</div>';
  fetch(APPS_SCRIPT_URL+'?type=get_recapture')
    .then(function(r){ return r.json(); })
    .catch(function(){ return null; })
    .then(function(d){
      if(!d||!d.success){ el.innerHTML='<div style="font-size:12px;color:var(--t3)">Could not load.</div>'; return; }
      if(!d.campaigns.length){ el.innerHTML='<div style="font-size:12px;color:var(--t3)">No campaigns yet.</div>'; return; }
      el.innerHTML = d.campaigns.map(function(cm){
        var rateCol = cm.rate>=20?'var(--f)':(cm.rate>=10?'#84cc16':'var(--t3)');
        var html = '<div style="background:#fafafa;border-radius:12px;padding:13px;margin-bottom:9px">'
          + '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:9px">'
          +   '<span style="font-family:\'Cormorant Garamond\',serif;font-size:17px;font-weight:700;color:var(--f)">'+cm.campaign+'</span>'
          +   '<span style="font-size:11px;color:var(--t3)">'+cm.started+'</span></div>'
          + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(78px,1fr));gap:7px;margin-bottom:8px">'
          +   box(cm.contacted,'Contacted')
          +   box(cm.returned,'Came back','var(--f)')
          +   box(cm.rate+'%','Return rate',rateCol)
          +   box('$'+cm.revenue,'Recovered','var(--f)')
          + '</div>';
        if(cm.pending) html += '<div style="font-size:11px;color:var(--t3);margin-bottom:6px">'+cm.pending+' still within the 30-day window — this can still improve.</div>';
        if(cm.returned) html += '<div style="font-size:11px;color:var(--t2);margin-bottom:4px">Average '+cm.avgDays+' days to come back</div>'
          + cm.people.slice(0,8).map(function(pp){
              return '<div style="font-size:11px;color:var(--t2);padding:2px 0;display:flex;justify-content:space-between"><span>'+pp.name+'</span><span style="color:var(--t3)">'+pp.days+'d · $'+pp.value+'</span></div>';
            }).join('');
        return html + '</div>';
      }).join('')
      + '<div style="font-size:11px;color:var(--t3);line-height:1.5;margin-top:4px">An order within '
      + d.windowDays + ' days of being contacted counts as a return. Later orders are not credited — '
      + 'they were probably coming back anyway.</div>';

      function box(v,l,col){
        return '<div style="background:#fff;border-radius:9px;padding:9px;text-align:center">'
          + '<div style="font-size:17px;font-weight:900;color:'+(col||'var(--t2)')+'">'+v+'</div>'
          + '<div style="font-size:10px;font-weight:700;color:var(--t3);margin-top:1px">'+l+'</div></div>';
      }
    });
}

function shareTag(where, name){
  var slug = (name || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  var tag = where + (slug ? '-' + slug : '');
  return tag.slice(0, 40).replace(/-+$/, '');
}

function shareLabel(tag){
  var m = /^(fbg|fbpage|nextdoor|instagram|flyer|other)(?:-(.+))?$/.exec(tag || ''), words = function(s){ return (s || '').replace(/-/g, ' '); };
  if(!m) return tag;
  var kind = SHARE_KINDS[m[1]];
  return kind ? kind + (m[2] ? ': ' + words(m[2]) : '') : words(m[2]);
}

function savedShareLinks(){ try{ return JSON.parse(localStorage.getItem('ls_share_links') || '[]'); }catch(e){ return []; } }

function buildShareLink(){
  var where = ($('lb-where') || {}).value || 'fbg', name = (($('lb-name') || {}).value || '').trim(), out = $('lb-out');
  if(!out) return;
  var needsName = where === 'fbg' || where === 'flyer' || where === 'other';
  var inp = $('lb-name');
  if(inp) inp.placeholder = where === 'fbg' ? 'Group name (e.g. Waterford Happenings)' : where === 'flyer' ? 'Where it went (e.g. Otter Ave)' : where === 'other' ? 'Name it (e.g. Church bulletin)' : 'Optional: which post (e.g. Halloween menu)';
  if(needsName && !name){ out.innerHTML = '<div style="font-size:12px;color:var(--t3)">Type the ' + (where === 'fbg' ? 'group\'s name' : 'name') + ' to make its link.</div>'; return; }
  var tag = shareTag(where, name), url = SHARE_BASE + '?src=' + tag;
  out.innerHTML = '<div style="background:var(--cr);border-radius:10px;padding:10px;font-size:13px;word-break:break-all"><strong>' + esc(shareLabel(tag)) + '</strong><br>'
    + '<span id="lb-url">' + esc(url) + '</span></div>'
    + '<button class="bp" style="margin-top:8px" onclick="copyShareLink(\'' + tag + '\')">📋 Copy link</button>';
  renderSavedShareLinks();
}

function copyShareLink(tag){
  var url = SHARE_BASE + '?src=' + tag;
  var list = savedShareLinks().filter(function(x){ return x.tag !== tag; });
  list.unshift({ tag: tag, at: Date.now() }); list = list.slice(0, 30);
  try{ localStorage.setItem('ls_share_links', JSON.stringify(list)); }catch(e){}
  var done = function(){ toast('📋 Copied. Paste it into your post.'); };
  if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function(){ prompt('Copy this link:', url); });
  else prompt('Copy this link:', url);
  renderSavedShareLinks();
}

function renderSavedShareLinks(){
  var el = $('lb-saved'); if(!el) return;
  var list = savedShareLinks();
  el.innerHTML = list.length ? '<div style="font-size:11px;font-weight:800;color:var(--t3);letter-spacing:.5px;margin-bottom:6px">LINKS YOU\'VE MADE</div>'
    + list.map(function(x){ return '<div style="display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--bd);font-size:13px">'
      + '<div style="flex:1;min-width:0">' + esc(shareLabel(x.tag)) + '<br><span style="font-size:11px;color:var(--t3)">' + esc(x.tag) + '</span></div>'
      + '<button onclick="copyShareLink(\'' + x.tag + '\')" style="border:1.5px solid var(--f);background:#fff;color:var(--f);border-radius:8px;padding:5px 10px;font-weight:700;cursor:pointer">Copy</button></div>'; }).join('') : '';
}

// ── GROCERY COST TRACKER ──
function getGroceryCosts(){
  try{ return JSON.parse(localStorage.getItem('grocery_costs')||'{}'); }catch(e){ return {}; }
}

function saveGroceryCost(month, amount){
  const costs=getGroceryCosts();
  if(!costs[month]) costs[month]=0;
  costs[month]+=amount;
  localStorage.setItem('grocery_costs', JSON.stringify(costs));
  buildMonthly();
  toast('✅ $'+amount+' added to '+month+' costs');
}

function openGroceryEntry(month){
  const d=$('grocery-modal');
  $('gm-month').textContent=month;
  $('gm-amount').value='';
  $('gm-note').value='';
  d.classList.remove('hidden');
}

function submitGrocery(){
  const month=$('gm-month').textContent;
  const amt=parseFloat($('gm-amount').value);
  if(!amt||amt<=0){ toast('❌ Please enter a valid amount'); return; }
  saveGroceryCost(month, amt);
  $('grocery-modal').classList.add('hidden');
}

function clearGroceryCost(month){
  const costs=getGroceryCosts();
  delete costs[month];
  localStorage.setItem('grocery_costs', JSON.stringify(costs));
  buildMonthly();
  toast('🗑️ Cost cleared for '+month);
}

// ── RETIRE CUSTOMERS ──
function retireCustomer(id, name){
  var retired={}; try{retired=JSON.parse(localStorage.getItem('retired_customers')||'{}');}catch(e){}
  retired[id]={name:name,date:new Date().toISOString()};
  try{localStorage.setItem('retired_customers',JSON.stringify(retired));}catch(e){}
  toast('🗄 '+name+' retired — records kept');
  buildCusts();
}

function unretireCustomer(id){
  var retired={}; try{retired=JSON.parse(localStorage.getItem('retired_customers')||'{}');}catch(e){}
  var name=retired[id]?retired[id].name:id;
  delete retired[id];
  try{localStorage.setItem('retired_customers',JSON.stringify(retired));}catch(e){}
  toast('✅ '+name+' restored');
  buildCusts();
}

function isRetiredCustomer(id){
  try{var r=JSON.parse(localStorage.getItem('retired_customers')||'{}');return !!r[id];}catch(e){return false;}
}

// ── SUGGEST NEXT WEEK'S SOUPS ──
function suggestNextWeek(){
  var retired={}; try{retired=JSON.parse(localStorage.getItem('retired_soups')||'{}');}catch(e){}
  // Score = avg_per_week * recency_factor
  // recency_factor: soups not on menu in 4+ weeks get boosted
  var _td=new Date();var today=_td.getFullYear()*10000+(_td.getMonth()+1)*100+_td.getDate();
  var candidates=SOUP_INTEL.filter(function(s){
    return s.cat==='Soup' && !retired[s.n] && s.avg>=50;
  });
  candidates.forEach(function(s){
    // Get last_sort from original snapshot if live data doesn't have it
    var _ls=s.last_sort;
    if(!_ls){
      var _orig=_SOUP_INTEL_ORIG.find(function(x){
        var w=(s.n||'').toLowerCase().split(/\s+/).filter(function(v){return v.length>3;});
        var xn=x.n.toLowerCase();
        return w.filter(function(v){return xn.indexOf(v)>=0;}).length>=Math.min(2,w.length||1);
      });
      _ls=_orig?_orig.last_sort:0;
    }
    var _lsDate=_ls?new Date(Math.floor(_ls/10000),Math.floor((_ls%10000)/100)-1,_ls%100):null;
    var daysSince=_lsDate?Math.floor((new Date()-_lsDate)/86400000):999;
    var recencyBoost=daysSince>56?2.0:daysSince>42?1.5:daysSince>28?1.1:daysSince>21?0.9:0.0;
    s._score=daysSince>21?s.avg*recencyBoost:0;
    s._days=daysSince;
  });
  candidates=candidates.filter(function(s){return s._score>0;});
  candidates.sort(function(a,b){return b._score-a._score;});

  var salads=SOUP_INTEL.filter(function(s){
    return s.cat==='Salad' && !retired[s.n];
  });
  salads.forEach(function(s){
    // Get last_sort from original snapshot if live data doesn't have it
    var _ls=s.last_sort;
    if(!_ls){
      var _orig=_SOUP_INTEL_ORIG.find(function(x){
        var w=(s.n||'').toLowerCase().split(/\s+/).filter(function(v){return v.length>3;});
        var xn=x.n.toLowerCase();
        return w.filter(function(v){return xn.indexOf(v)>=0;}).length>=Math.min(2,w.length||1);
      });
      _ls=_orig?_orig.last_sort:0;
    }
    var _lsDate=_ls?new Date(Math.floor(_ls/10000),Math.floor((_ls%10000)/100)-1,_ls%100):null;
    var daysSince=_lsDate?Math.floor((new Date()-_lsDate)/86400000):999;
    var recencyBoost=daysSince>90?2.0:daysSince>60?1.5:daysSince>30?1.1:daysSince>21?0.5:0.0;
    s._score=daysSince>21?s.avg*recencyBoost:0;
  });
  salads=salads.filter(function(s){return s._score>0;});
  salads.sort(function(a,b){return b._score-a._score;});

  var top3soups=candidates.slice(0,3);
  var top2salads=salads.slice(0,2);

  var el=$('suggestion-box');
  if(!el) return;
  var html='<div style="font-size:13px;font-weight:700;color:var(--f);margin-bottom:10px">🤖 Suggested Menu for Next Week</div>';
  html+='<div style="font-size:11px;color:var(--t3);margin-bottom:10px">Based on highest avg revenue × time since last offered:</div>';
  html+='<div style="display:grid;gap:7px">';
  top3soups.forEach(function(s,i){
    html+='<div style="background:#fff;border-radius:8px;padding:8px 10px;border:1px solid var(--bd)">';
    html+='<div style="font-weight:700">🥣 Soup '+(i+1)+': '+s.n+'</div>';
    html+='<div style="font-size:10px;color:var(--t3)">$'+s.avg+'/wk avg · Last: '+(_getLD(s)||'—')+' · Score: '+Math.round(s._score)+'</div>';
    html+='</div>';
  });
  top2salads.forEach(function(s,i){
    html+='<div style="background:#fff;border-radius:8px;padding:8px 10px;border:1px solid var(--bd)">';
    html+='<div style="font-weight:700">🥗 Salad '+(i+1)+': '+s.n+'</div>';
    html+='<div style="font-size:10px;color:var(--t3)">$'+s.avg+'/wk avg · Last: '+(_getLD(s)||'—')+'</div>';
    html+='</div>';
  });
  html+='</div>';
  el.innerHTML=html;
  el.style.display='block';
}

function saveSchedule(){
  SCHEDULE.bannerStart    = $('sch-banner-start')   ? $('sch-banner-start').value   : '';
  SCHEDULE.lastDelivery   = $('sch-last-delivery')  ? $('sch-last-delivery').value  : '';
  SCHEDULE.vacationStart  = $('sch-vac-start')      ? $('sch-vac-start').value      : '';
  SCHEDULE.vacationBack   = $('sch-vac-back')       ? $('sch-vac-back').value       : '';
  SCHEDULE.vacationMsg    = $('sch-vac-msg')        ? $('sch-vac-msg').value.trim() : '';
  SCHEDULE.specialDeadline     = $('sch-deadline')       ? $('sch-deadline').value      : '';
  SCHEDULE.specialDeliveryDate = $('sch-delivery-date')  ? $('sch-delivery-date').value : '';
  SCHEDULE.specialDeliveryLabel= $('sch-delivery-label') ? $('sch-delivery-label').value.trim() : '';
  SCHEDULE.loyaltyLaunchDate   = $('sch-loyalty-launch') ? $('sch-loyalty-launch').value : '';
  try{ localStorage.setItem('ladle_schedule', JSON.stringify(SCHEDULE)); }catch(e){}
  initScheduleDisplay();
  countdown();
  // Push to Apps Script so EVERY customer's device sees the same schedule —
  // not just this admin browser's localStorage.
  if(APPS_SCRIPT_URL){
    toast('Saving schedule for all customers…');
    fetch(APPS_SCRIPT_URL, {
      method:  'POST',
      body:    JSON.stringify({ type: 'save_schedule', schedule: SCHEDULE }),
      headers: { 'Content-Type': 'text/plain' }
    })
    .then(function(r){ return r.text(); })
    .then(function(){ toast('✅ Schedule saved for all customers!'); })
    .catch(function(){ toast('⚠️ Saved locally, but sync to server failed — try again.'); });
  } else {
    toast('Schedule saved!');
  }
}

function clearSchedule(){
  if(!confirm('Clear all schedule settings?')) return;
  SCHEDULE = {};
  try{ localStorage.removeItem('ladle_schedule'); }catch(e){}
  buildScheduleAdmin();
  initScheduleDisplay();
  countdown();
  if(APPS_SCRIPT_URL){
    fetch(APPS_SCRIPT_URL, {
      method:  'POST',
      body:    JSON.stringify({ type: 'save_schedule', schedule: {} }),
      headers: { 'Content-Type': 'text/plain' }
    })
    .then(function(){ toast('Schedule cleared for all customers'); })
    .catch(function(){ toast('Cleared locally — server sync failed'); });
  } else {
    toast('Schedule cleared');
  }
}

function scheduleChanged(){
  // Live-update the preview panel
  var preview = $('sch-preview');
  if(!preview) return;
  var lines = [];
  var bs = $('sch-banner-start') && $('sch-banner-start').value;
  var ld = $('sch-last-delivery') && $('sch-last-delivery').value;
  var vs = $('sch-vac-start') && $('sch-vac-start').value;
  var vb = $('sch-vac-back') && $('sch-vac-back').value;
  var vm = $('sch-vac-msg') && $('sch-vac-msg').value.trim();
  var dl = $('sch-deadline') && $('sch-deadline').value;
  var dd = $('sch-delivery-date') && $('sch-delivery-date').value;
  var dlbl = $('sch-delivery-label') && $('sch-delivery-label').value.trim();
  if(bs) lines.push('<strong>Banner starts:</strong> ' + new Date(bs).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}));
  if(ld) lines.push('<strong>Last delivery before vacation:</strong> ' + new Date(ld).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}));
  if(vs) lines.push('<strong>Vacation begins:</strong> ' + new Date(vs).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}));
  if(vb) lines.push('<strong>Back &amp; delivering:</strong> ' + new Date(vb).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}));
  if(vm) lines.push('<strong>Banner message:</strong> ' + vm);
  if(dl) lines.push('<strong>Special deadline:</strong> ' + new Date(dl).toLocaleString('en-US',{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',hour12:true}));
  if(dd) lines.push('<strong>Special delivery date:</strong> ' + new Date(dd).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}));
  if(dlbl) lines.push('<strong>Delivery label:</strong> ' + dlbl);
  preview.innerHTML = lines.length ? lines.join('<br>') : '<span style="color:var(--t3)">No schedule settings entered yet.</span>';
}

function buildScheduleAdmin(){
  if($('sch-banner-start'))   $('sch-banner-start').value   = SCHEDULE.bannerStart   ||'';
  if($('sch-last-delivery'))  $('sch-last-delivery').value  = SCHEDULE.lastDelivery  ||'';
  if($('sch-vac-start'))      $('sch-vac-start').value      = SCHEDULE.vacationStart ||'';
  if($('sch-vac-back'))       $('sch-vac-back').value       = SCHEDULE.vacationBack  ||'';
  if($('sch-vac-msg'))        $('sch-vac-msg').value        = SCHEDULE.vacationMsg   ||'';
  if($('sch-deadline'))       $('sch-deadline').value       = SCHEDULE.specialDeadline||'';
  if($('sch-delivery-date'))  $('sch-delivery-date').value  = SCHEDULE.specialDeliveryDate||'';
  if($('sch-delivery-label')) $('sch-delivery-label').value = SCHEDULE.specialDeliveryLabel||'';
  if($('sch-loyalty-launch')) $('sch-loyalty-launch').value = SCHEDULE.loyaltyLaunchDate||'';
  scheduleChanged();
}

// ── FEATURE 6: PUSH NOTIFICATIONS ──
function testMyNotification(){
  if(!('Notification' in window)){ toast('Notifications not supported on this browser'); return; }
  if(Notification.permission !== 'granted'){ toast('Notifications not enabled on this device yet — tap the bell icon first'); return; }
  try{
    new Notification('Ladle & Spoon 🍲', {
      body: 'Test successful! Notifications are working on this device.',
      icon: 'https://res.cloudinary.com/drcjmvjc9/image/upload/v1/ladle-soup-photos/logo'
    });
    toast('✅ Test notification sent — check your device!');
  }catch(e){
    toast('Could not send test: ' + e.message);
  }
}

function requestNotifPermission(){
  if(!('Notification' in window)){toast('Notifications not supported on this device');return;}
  Notification.requestPermission().then(p=>{
    if(p==='granted'){
      localStorage.setItem('notif_enabled','1');
      toast('🔔 Notifications enabled! You\'ll hear when the menu drops.');
      new Notification('Ladle & Spoon',{body:'You\'re subscribed to menu notifications! 🥣',icon:'/icon.png'});
    } else {
      toast('Notifications blocked — you can enable in browser settings');
    }
  });
}

// S-026 (v262): Publish already sends the "menu is live" push (gs74+, counted under the
// Publish button). This is only for an extra one, so it asks first, says so, and reports
// what the server answered. It used to be a no-cors request that always said "sent".
function sendMenuNotification(items){
  const title   = '🥣 This week\'s menu is live!';
  const body    = items.length + ' items ready — order by Friday 7 PM for Monday delivery!';
  fetch(APPS_SCRIPT_URL, {
    method:  'POST',
    body:    JSON.stringify({ type:'broadcast', title, body }),
    headers: { 'Content-Type': 'text/plain' }
  })
  .then(function(r){ return r.json(); })
  .then(function(d){
    if(!d || d.success === false) toast('⚠️ Push not sent: ' + ((d && d.error) || 'unknown error'));
    else if(typeof d.sent === 'number') toast('📣 Push sent to ' + d.sent + ' phone' + (d.sent === 1 ? '' : 's'));
    else toast('📣 Push is on its way (sending in the background)');
  })
  .catch(function(){ toast('⚠️ Network error — push not sent'); });
}

function sendAllNotif(){
  var lp = typeof LAST_PUBLISH !== 'undefined' ? LAST_PUBLISH : null;
  var already = lp && lp.thisWeek && lp.ok;
  if(!confirm((already
      ? 'Publish already sent the "menu is live" push this week' + (typeof lp.pushes === 'number' ? ' (' + lp.pushes + ' phones)' : '') + '.\n\nSend it AGAIN to every subscribed phone?'
      : 'Send a "menu is live" push notification to every subscribed customer now?\n\n(Publish This Week\'s Menu sends one too.)'))) return;
  sendMenuNotification(MENU_ITEMS);
}

function weeklyResetTest(){
  // Dry run - shows what would happen without making any changes
  var today = new Date();
  var day = today.getDay();
  var monday = new Date(today);
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
  var tabName = (monday.getMonth()+1) + '/' + monday.getDate();
  var localOrders = [];
  try{ localOrders = JSON.parse(localStorage.getItem('submitted_orders')||'[]'); }catch(e){}
  var liveOrders = ORDERS || [];
  var msg = '🧪 DRY RUN — Nothing will change\n\n';
  msg += '📋 What WOULD happen:\n';
  msg += '1. Rename Sheet tab "Soup orders" → "' + tabName + '"\n';
  msg += '2. Create fresh empty "Soup orders" tab\n';
  msg += '3. Clear ' + localOrders.length + ' local app orders from this device\n';
  msg += '4. Clear session cache (admin will reload fresh)\n';
  msg += '5. Clear menu items (Lia sets new menu in Sheet)\n\n';
  msg += '📊 Current state:\n';
  msg += '• Live orders in Sheet: ' + liveOrders.length + '\n';
  msg += '• Local orders on device: ' + localOrders.length + '\n';
  msg += '• Archive tab name would be: ' + tabName + '\n\n';
  msg += '✅ No changes made. Tap "Archive Week & Start Fresh" when ready to go live.';
  // Also verify Apps Script connection
  fetch(APPS_SCRIPT_URL + '?type=archive_week&dry_run=true')
    .then(function(r){ return r.json(); })
    .then(function(d){
      var sheetMsg = d.dry_run ? '\n\n🔗 Sheet connection: ✅ OK\n' + d.message : '\n\n⚠️ Sheet: ' + (d.error||JSON.stringify(d));
      alert(msg + sheetMsg);
    })
    .catch(function(err){ alert(msg + '\n\n⚠️ Sheet connection failed: ' + err.message); });
}

// S-006 (v253): a second archive in the same week used to delete last week's archived
// orders (gs74 now refuses it). Here: the dry run's numbers go in the confirm, the button
// is locked while it runs, and an unclear failure says to check before trying again.
function weeklyReset(btn){
  if(btn && btn.disabled) return;
  function unlock(){ if(btn){ btn.disabled = false; btn.innerHTML = btn.dataset.label || btn.innerHTML; } }
  if(btn){ btn.disabled = true; btn.dataset.label = btn.dataset.label || btn.innerHTML; btn.innerHTML = 'Checking…'; }
  fetch(APPS_SCRIPT_URL + '?type=archive_week&dry_run=true')
    .then(function(r){ return r.json(); })
    .then(function(dry){
      if(!dry || !dry.dry_run){ toast('⚠️ Could not check the Sheet: ' + ((dry && dry.error) || 'unknown error') + '. Nothing changed.'); unlock(); return; }
      if(dry.already){ alert(dry.message); unlock(); return; }
      if(typeof dry.orders !== 'number') dry.orders = (ORDERS || []).length;   // backend before gs74
      var notInvoiced = (ORDERS || []).filter(function(o){ return o.email && !o.delivered; }).length;
      var msg = 'Archive ' + dry.orders + ' order' + (dry.orders === 1 ? '' : 's') + ' to the tab "' + dry.archived + '" and start a fresh week?'
        + (notInvoiced ? '\n\n⚠️ ' + notInvoiced + ' order' + (notInvoiced === 1 ? ' has' : 's have') + ' not been invoiced. After archiving, invoices can\'t be sent from the app.' : '')        + '\n\nThis cannot be undone.';
      if(!confirm(msg)){ unlock(); return; }
      if(btn) btn.innerHTML = 'Archiving…';
      toast('⏳ Archiving week...');
      return fetch(APPS_SCRIPT_URL + '?type=archive_week')
    .then(function(r){ return r.json(); })
    .then(function(d){
      unlock();
      if(d.success){
        // 2. Clear localStorage orders
        try{ localStorage.removeItem('submitted_orders'); }catch(e){}
        try{ localStorage.removeItem('route_paid'); routeClearWeek(); }catch(e){}
        // 3. Clear session cache so admin refreshes
        try{ sessionStorage.removeItem('admin_data'); sessionStorage.removeItem('admin_data_time'); }catch(e){}
        // 4. Clear MENU_ITEMS so Lia can set next week's menu
        MENU_ITEMS = [];
        WKMENU = [];
        ORDERS = [];
        buildMenu();
        buildOrders();
        toast('✅ Week ' + (d.archived||'') + ' archived! Update menu in the Sheet and publish.');
      } else if(d.already){
        alert(d.error);
      } else {
        toast('⚠️ Archive failed: ' + (d.error||'unknown error'));
      }
    })
    .catch(function(){
      unlock();
      alert('Not sure the archive went through (Google did not answer clearly).\n\nBefore trying again, open the Sheet and look for a tab named for this Monday. If it is there, the week is archived.');
    });
    })
    .catch(function(){ unlock(); toast('⚠️ Could not reach the Sheet. Nothing changed.'); });
}

function photoSlug(n){ return String(n||'').toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,''); }

function serverHasPhoto(item){
  if(!SERVER_PHOTOS) return true;
  var n = String(item.n||'').toLowerCase();
  return [item.soupId, item.id, n, photoSlug(n)].some(function(k){ return k && SERVER_PHOTOS[k]; });
}

function localPhotoFor(item){
  var lp = {}; try{ lp = JSON.parse(localStorage.getItem('soup_photos')||'{}') || {}; }catch(e){}
  var n = String(item.n||'').toLowerCase();
  var keys = [n, photoSlug(n), item.id, item.soupId, item.n];
  for(var i = 0; i < keys.length; i++){ var v = keys[i] && lp[keys[i]]; if(v && String(v).length > 50) return String(v); }
  return '';
}

function syncLocalMenuPhotos(){
  if(!SERVER_PHOTOS || typeof isAdmin === 'undefined' || !isAdmin) return;
  (MENU_ITEMS||[]).forEach(function(item){
    if(!item || !item.n || serverHasPhoto(item) || _photoSyncTried[item.n]) return;
    var local = localPhotoFor(item); if(!local) return;
    _photoSyncTried[item.n] = 1;
    var up;
    if(/^https:\/\/res\.cloudinary\.com\//.test(local)) up = Promise.resolve(local);
    else if(/^data:image\//.test(local)){
      var fd = new FormData(); fd.append('upload_preset', CLOUDINARY_PRESET); fd.append('folder', 'ladle-and-spoon-soups'); fd.append('file', local);
      up = fetch(CLOUDINARY_URL, { method:'POST', body:fd }).then(function(r){ return r.json(); }).then(function(d){ return (d && d.secure_url) || ''; });
    } else return;
    up.then(function(url){
      if(!url) return;
      return fetch(APPS_SCRIPT_URL, { method:'POST', headers:{ 'Content-Type':'text/plain' },
        body: JSON.stringify({ type:'save_photo', soupId:item.n.toLowerCase(), url:url, name:item.n }) })
        .then(function(r){ return r.json(); })
        .then(function(d){
          if(d && d.success){ SERVER_PHOTOS[item.n.toLowerCase()] = url; toast('📷 Saved the ' + item.n + ' photo so customers see it too'); }
        });
    }).catch(function(e){ console.warn('photo sync for ' + item.n + ' failed', e); });
  });
}

function _fetchAndApplyPhotos(){
  if(!APPS_SCRIPT_URL) return;
  fetch(APPS_SCRIPT_URL + '?type=get_photos')
    .then(function(r){ return r.json(); })
    .then(function(d){
      if(!d || !d.photos) return;
      var photos = d.photos;
      SERVER_PHOTOS = Object.assign({}, photos);
      setTimeout(syncLocalMenuPhotos, 0);
      var keys = Object.keys(photos);
      console.log('_fetchAndApplyPhotos: got', keys.length, 'photo keys');
      keys.forEach(function(sid){
        var url = photos[sid];
        if(!url) return;
        // Store in SOUP_PHOTOS
        SOUP_PHOTOS[sid] = url;
        SOUP_PHOTOS[sid.toLowerCase()] = url;
        // Clean key
        var cleanKey = sid.toLowerCase().replace(/^intel-/,'').replace(/-/g,' ')
          .replace(/\s+(this |the |a |an |with |served |has |)[a-z].*/i,'').trim();
        SOUP_PHOTOS[cleanKey] = url;
        // Match to MENU_ITEMS by name
        MENU_ITEMS.forEach(function(mi){
          var mn = mi.n.toLowerCase();
          if(mn === cleanKey || mn === sid.toLowerCase() ||
             cleanKey.indexOf(mn) === 0 || mn.indexOf(cleanKey) === 0){
            var _lu=_uploadedPhotos[mn]; mi.photo=(_lu&&_lu!==url)?_lu:url;
            SOUP_PHOTOS[mn] = mi.photo;
            console.log('Photo applied to menu item:', mi.n, '← key:', sid);
          }
        });
        // Match to ALL_SOUPS
        var soup = ALL_SOUPS.find(function(s){
          var sn = s.n.toLowerCase();
          return sn === cleanKey || sn === sid.toLowerCase();
        });
        if(soup){ soup.photo = url; SOUP_PHOTOS[soup.n.toLowerCase()] = url; }
      });
      buildMenu();
    }).catch(function(){});
}

function syncPhotoToSheet(name, url){
  if(!url || !APPS_SCRIPT_URL) return;
  toast('Syncing photo for ' + name + '...');
  fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify({type:'save_photo', soupId:name.toLowerCase(), url:url, name:name}),
    headers: {'Content-Type':'text/plain'}
  })
  .then(function(r){return r.json();})
  .then(function(d){
    if(d&&d.success){ toast('✅ '+name+' photo saved to Sheet!'); loadSavedPhotos(); }
    else { toast('❌ Save failed'); console.error(d); }
  }).catch(function(e){ toast('❌ Error: '+e.message); console.error(e); });
}

function forceSyncAllPhotos(){
  var lp={};try{lp=JSON.parse(localStorage.getItem('soup_photos')||'{}');}catch(e){}
  var entries = Object.entries(lp).filter(function(e){ return e[1] && e[1].length > 50; });
  if(!entries.length){ toast('No local photos to sync'); return; }
  toast('Syncing ' + entries.length + ' photos...');
  var done=0, succeeded=0, failed=0;
  entries.forEach(function(pair){
    var name=pair[0], url=pair[1];
    fetch(APPS_SCRIPT_URL, {
      method:'POST',
      body: JSON.stringify({type:'save_photo', soupId:name.toLowerCase(), url:url, name:name}),
      headers:{'Content-Type':'text/plain'}
    })
    .then(function(r){ return r.json(); })
    .then(function(d){
      done++;
      if(d&&d.success) succeeded++;
      else { failed++; console.error('Photo sync failed for '+name+':', d); }
      if(done===entries.length){
        toast('✅ '+succeeded+' photos synced'+(failed?' ('+failed+' failed)':'')+'!');
        _fetchAndApplyPhotos(); buildPhotoUploader();
      }
    })
    .catch(function(err){
      done++; failed++;
      console.error('Photo sync error for '+name+':', err);
      if(done===entries.length) toast('⚠️ '+succeeded+' synced, '+failed+' failed');
    });
  });
}

function buildPhotoUploader(){
  var el=$('photo-upload-list');
  // Only while Admin → Soups is on screen. It used to be built for every visitor after
  // photos loaded, and its ~110 hidden <img>s downloaded ~4 MB per visit (S-015). The
  // Soups tab button builds it when Lia opens it.
  if(!el || !el.offsetParent) return;
  var lp={};try{lp=JSON.parse(localStorage.getItem('soup_photos')||'{}');}catch(e){}

  // Show all soups so Lia can add/update any photo
  var allSoups=ALL_SOUPS.slice().sort(function(a,b){
    var aHas=a.photo&&a.photo.length>50?1:0;
    var bHas=b.photo&&b.photo.length>50?1:0;
    return aHas-bHas; // missing photos first
  });
  var html='<div style="margin-bottom:10px">'
    +'<button onclick="forceSyncAllPhotos()" style="background:var(--am);color:#fff;border:none;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer">🔄 Force Sync All Photos to Sheet</button>'
    +'</div>';
  allSoups.forEach(function(s){
    var photo = (s.photo&&s.photo.length>50) ? s.photo : (lp[s.n.toLowerCase()]||lp[s.n.toLowerCase().replace(/\s+/g,'-')]||'');
    var hasPh=photo.length>50;
    // Show Sync if photo exists in localStorage (not just if missing from SOUP_PHOTOS)
    var inSheet = !!(SOUP_PHOTOS[s.n.toLowerCase()]);
    var needsSync = hasPh && !inSheet;
    html+='<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--bd)">'
      +'<div style="width:44px;height:44px;border-radius:8px;overflow:hidden;background:var(--cr);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:22px">'
      +(hasPh?'<img src="'+photoUrl(photo)+'" loading="lazy" style="width:100%;height:100%;object-fit:cover">':s.em||'🥣')
      +'</div>'
      +'<div style="flex:1;font-size:13px;font-weight:600">'+s.n+(needsSync?'<span style="font-size:10px;color:orange;display:block">⚠️ not synced to Sheet</span>':'')+'</div>'
      +(needsSync?'<button onclick="syncPhotoToSheet(\''+s.n.replace(/'/g,"\\'")+'\',' +'\''+photo+'\')" style="background:orange;color:#fff;border:none;border-radius:8px;padding:6px 10px;font-size:11px;font-weight:700;cursor:pointer">Sync</button>':'')
      +'<label style="cursor:pointer;background:var(--f);color:#fff;border-radius:8px;padding:6px 12px;font-size:11px;font-weight:700">'
      +(hasPh?'Update':'+ Photo')
      +'<input type="file" accept="image/*" style="display:none" data-sid="'+(s.id||'')+'" data-name="'+s.n+'" onchange="handlePhotoUpload(this)">'
      +'</label>'
      +'</div>';
  });
  var missingCount=allSoups.filter(function(s){return !s.photo||s.photo.length<50;}).length;
  if(missingCount===0) html+='<div style="font-size:12px;color:var(--sg);font-weight:600;padding:4px 0 8px">✅ All soups have photos — tap Update to change one</div>';
  el.innerHTML=html;
}

function handlePhotoUpload(input){
  var file = input.files[0];
  if(!file) return;
  var sid  = input.dataset.sid;
  var name = input.dataset.name || sid;
  var soup = ALL_SOUPS.find(function(s){ return s.n === name || s.id === sid; });
  // Use name-based key for storage — IDs can change but names are stable
  var photoKey = name.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');

  toast('📤 Uploading photo…');
  console.log('Starting upload for', name, 'sid:', sid, 'preset:', CLOUDINARY_PRESET);

  // Upload directly to Cloudinary (unsigned)
  var formData = new FormData();
  formData.append('upload_preset', CLOUDINARY_PRESET);
  formData.append('folder', 'ladle-and-spoon-soups');
  formData.append('public_id', 'soup_' + sid + '_' + Date.now());

  shrinkPhoto(file)
  .then(function(small){
    formData.append('file', small);
    return fetch(CLOUDINARY_URL, { method: 'POST', body: formData });
  })
  .then(function(res){ return res.json(); })
  .then(function(data){
    if(data.secure_url){
      var url = data.secure_url;
      console.log('Cloudinary upload success! URL:', url);
      // Store the Cloudinary URL — use name-based key for cross-device stability
      if(soup) soup.photo = url;
      SOUP_PHOTOS[name.toLowerCase()] = url;
      _uploadedPhotos[name.toLowerCase()] = url; // protect from stale sheet overwrites
      // Stamp directly on MENU_ITEMS so buildMenu shows it immediately
      MENU_ITEMS.forEach(function(mi){ if(mi.n.toLowerCase()===name.toLowerCase()) mi.photo=url; });

      try{
        var photos = JSON.parse(localStorage.getItem('soup_photos') || '{}');
        photos[photoKey] = url;
        photos[name.toLowerCase()] = url; // spaces version
        if(sid) photos[sid] = url;       // original id (only if defined)
        localStorage.setItem('soup_photos', JSON.stringify(photos));
      }catch(e){}

      if(APPS_SCRIPT_URL){
        fetch(APPS_SCRIPT_URL, {
          method: 'POST',
          body: JSON.stringify({type:'save_photo', soupId:name.toLowerCase(), url:url, name:name}),
          headers: {'Content-Type':'text/plain'}
        })
        .then(function(r){return r.json();})
        .then(function(d){
          if(d&&d.success){ console.log('✅ Photo saved to Sheet for:', name); delete _uploadedPhotos[name.toLowerCase()]; }
          else { console.error('❌ Photo save to Sheet FAILED:', d); toast('⚠️ Photo on Cloudinary but not saved to Sheet — use Sync button'); }
        })
        .catch(function(e){ console.error('❌ Photo save error:', e); toast('⚠️ Photo uploaded but not saved for customers yet. It will retry next time you open Admin.'); });
      }

      // Also update SOUP_PHOTOS for getSoupPhoto() lookups
      SOUP_PHOTOS[name.toLowerCase()] = url;

      toast('✅ Photo uploaded for ' + name + '!');
      buildPhotoUploader();
      buildRepo();
      buildMenu(); // refresh menu cards to show new photo
    } else {
      console.error('Cloudinary error:', data);
      toast('⚠️ Upload failed — ' + (data.error && data.error.message || 'try again'));
    }
  })
  .catch(function(err){
    console.error('Upload error:', err);
    toast('⚠️ Upload failed — check your connection');
  });
}

function initNotifUI(){
  var enabled = localStorage.getItem('notif_enabled') === '1';
  if(enabled && Notification.permission !== 'granted'){
    localStorage.removeItem('notif_enabled');
    enabled = false;
  }
  updateNotifUI(enabled);
}

function fmtPublishTime(iso){
  var d = new Date(iso); if(isNaN(d)) return '';
  return d.toLocaleDateString('en-US', { weekday:'short' }) + ' ' + d.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });
}

function renderPublishStatus(lp, pendingNote){
  var el = $('publish-status'); if(!el) return;
  var html = '';
  if(pendingNote){
    html = '<span style="color:var(--t2)">⏳ ' + pendingNote + '</span>';
  } else if(lp && lp.ok === false){
    html = '<span style="color:#b91c1c;font-weight:700">⚠️ Last try (' + fmtPublishTime(lp.at) + ') did not send: ' + (lp.error || 'unknown error') + '</span>';
  } else if(lp && lp.ok){
    html = '<span style="color:var(--f);font-weight:700">✅ ' + (lp.thisWeek ? 'Announced this week' : 'Last announced') + ' · ' + fmtPublishTime(lp.at) + '</span><br>'
         + '<span style="color:var(--t3)">Emailed ' + (lp.sent||0) + (lp.skipped ? ' · <b style="color:#b45309">' + lp.skipped + ' held back by today\'s email limit</b> (publish again tomorrow to reach them)' : '')
         + ' · push ' + (lp.pushes ? 'sent to ' + lp.pushes + ' phone' + (lp.pushes===1?'':'s') : 'sent')
         + (lp.sms ? ' · ' + lp.sms + ' texts' : '') + '</span>';
  }
  el.innerHTML = html;
  el.style.display = html ? '' : 'none';
}

function publishMenu(btn){
  if(!(MENU_ITEMS || []).length){
    alert('There is no menu on the Sheet yet.\n\nAdd this week\'s items above and tap "Save Menu to Sheet" first, then Publish.');
    return;
  }
  var force = false, lp = LAST_PUBLISH;
  if(lp && lp.ok && lp.thisWeek){
    if(!confirm('This week\'s menu was already announced (' + fmtPublishTime(lp.at) + (lp.pending ? ', still sending' : ', ' + (lp.sent||0) + ' emailed') + ').\n\n'
      + 'Send it again? Nobody is emailed twice in one day, but every subscriber gets the push again.')) return;
    force = true;
  } else if(!confirm('Send the menu announcement to all customers now?\n\nThis will email everyone and send a push notification to subscribers.')) return;

  if(!APPS_SCRIPT_URL) return;
  if(btn){ btn.disabled = true; btn.dataset.label = btn.dataset.label || btn.innerHTML; btn.innerHTML = 'Sending…'; }
  fetch(APPS_SCRIPT_URL, {
    method:  'POST',
    body:    JSON.stringify(force ? { type: 'publish_menu', force: true } : { type: 'publish_menu' }),
    headers: { 'Content-Type': 'text/plain' }
  })
  .then(function(r){ return r.json(); })
  .then(function(d){
    if(d && d.queued){
      toast('📢 Announcement is on its way');
      LAST_PUBLISH = { ok:true, thisWeek:true, at:new Date().toISOString(), sent:0, pending:true };
      renderPublishStatus(null, 'Sending now. The result (how many were emailed) shows here within a few minutes; reopen Admin to update it.');
      // Once Apps Script has run, the Dash data carries the result.
      setTimeout(function(){ try{ sessionStorage.removeItem('admin_data_time'); }catch(e){} refreshAdminData(); }, 90000);
    } else if(d && d.published){
      LAST_PUBLISH = { ok:true, at:new Date().toISOString(), thisWeek:true, sent:d.sent, skipped:d.skipped, pushes:d.pushes, sms:d.sms };
      renderPublishStatus(LAST_PUBLISH);
      toast('✅ ' + (d.message || 'Menu published'));
    } else if(d && d.success && d.published === false){
      toast(d.already ? 'Already announced this week. Nothing sent again.' : '⚠️ ' + (d.error || 'Not sent'));
      if(d.noMenu) renderPublishStatus({ ok:false, at:new Date().toISOString(), error:d.error });
    } else {
      toast('⚠️ Not sent: ' + ((d && d.error) || 'unknown error') + '. Try again.');
    }
  })
  .catch(function(){
    toast('⚠️ Not sure it went through. Check back in a few minutes before trying again.');
  })
  .finally(function(){ if(btn){ btn.disabled = false; btn.innerHTML = btn.dataset.label; } });
}

function _refFriendPhone(){var el=$('ref-friend-phone');return el?el.value.replace(/\D/g,''):''}

function refShareText(){
  var code=_refCode();if(!code){toast('Add your phone number to your profile to get a referral code!');return;}
  var msg=_refMsg(code,_refFriendName());
  window.open('sms:'+_refFriendPhone()+'?body='+encodeURIComponent(msg),'_blank');
}

function openAskHelp(){
  if(document.getElementById('help-ov')) return;
  var ov = document.createElement('div'); ov.className = 'ov'; ov.id = 'help-ov';
  ov.onclick = function(e){ if(e.target === ov) closeAskHelp(); };
  ov.innerHTML = '<div class="sheet" style="padding:18px 16px 20px;display:flex;flex-direction:column;max-height:85vh">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><strong style="font-size:17px;color:var(--f)">Ask a question</strong>'
    + '<button onclick="closeAskHelp()" aria-label="Close" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--t2)">✕</button></div>'
    + '<div style="font-size:12px;color:var(--t3);margin-bottom:10px">Answers come from your user manual. If it isn\'t sure, text Tony.</div>'
    + '<div id="help-log" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:8px;min-height:60px;margin-bottom:10px"></div>'
    + '<div style="display:flex;gap:8px;align-items:stretch"><textarea id="help-q" rows="2" placeholder="e.g. How do I approve an order?" '
    + 'onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();sendAskHelp();}" '
    + 'style="flex:1;padding:10px;border-radius:10px;border:2px solid #e5e7eb;font-size:15px;font-family:inherit;resize:none"></textarea>'
    + '<button id="help-send" class="bp" onclick="sendAskHelp()" style="width:auto;margin:0;padding:0 18px">Ask</button></div></div>';
  document.body.appendChild(ov);
  renderAskHelp();
  var q = document.getElementById('help-q'); if(q) q.focus();
}

function closeAskHelp(){ var ov = document.getElementById('help-ov'); if(ov) ov.remove(); }

function renderAskHelp(){
  var log = document.getElementById('help-log'); if(!log) return;
  log.innerHTML = HELP_MSGS.map(function(m){
    var mine = m.role === 'user';
    return '<div class="help-msg' + (mine ? ' mine' : '') + '" style="align-self:' + (mine ? 'flex-end' : 'flex-start') + ';max-width:85%;white-space:pre-wrap;'
      + 'padding:9px 12px;border-radius:14px;font-size:14px;line-height:1.45;'
      + (mine ? 'background:var(--f);color:#fff' : m.err ? 'background:#fdecea;color:#7f1d1d' : 'background:var(--cr);color:var(--tx)') + '">' + esc(m.content) + '</div>';
  }).join('') + (HELP_BUSY ? '<div style="align-self:flex-start;font-size:13px;color:var(--t3)">Looking that up…</div>' : '');
  log.scrollTop = log.scrollHeight;
  var b = document.getElementById('help-send'); if(b) b.disabled = HELP_BUSY;
}

function sendAskHelp(){
  var q = document.getElementById('help-q'), text = q ? q.value.trim() : '';
  if(!text || HELP_BUSY) return;
  HELP_MSGS.push({ role:'user', content:text }); q.value = ''; HELP_BUSY = true; renderAskHelp();
  var convo = HELP_MSGS.filter(function(m){ return !m.err; }).slice(-8).map(function(m){ return { role:m.role, content:m.content }; });
  fetch(APPS_SCRIPT_URL, { method:'POST', headers:{ 'Content-Type':'text/plain' }, body: JSON.stringify({ type:'ask_help', messages: convo }) })
    .then(function(r){ if(!r.ok) throw new Error('Google did not answer'); return r.json(); })
    .then(function(d){
      if(d && d.success) HELP_MSGS.push({ role:'assistant', content:d.answer });
      else HELP_MSGS.push({ role:'assistant', err:true, content:(d && d.error) || 'Something went wrong. Try again.' });
    })
    .catch(function(){ HELP_MSGS.push({ role:'assistant', err:true, content:'Couldn\'t reach the helper. Check your connection and try again.' }); })
    .then(function(){ HELP_BUSY = false; renderAskHelp(); });
}

function trendClass(t){return t.includes('📈')?'trend-up':t.includes('📉')?'trend-dn':'trend-st';}

function trendArrow(t){return t.includes('📈')?'📈':t.includes('📉')?'📉':'⚖️';}

// Google's web-app front end often adds 10–30 s, or answers with an error page, before
// our code even runs (measured 2026-09-29: 11–32 s for requests that take ~50 ms of
// work). Admin loads therefore (1) retry an error page like get_menu does, (2) fetch
// both halves of the Dash at once instead of one after the other, and (3) show the
// last revenue figures straight away while the fresh ones are on their way.
function adminFetchJson(url){
  function attempt(n){
    return fetch(url)
      .then(function(r){ if(!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .catch(function(e){
        if(n >= MENU_RETRY_DELAYS.length) throw e;
        console.warn('Admin load failed (' + e.message + '), retrying');
        return new Promise(function(res){ setTimeout(res, MENU_RETRY_DELAYS[n]); })
          .then(function(){ return attempt(n + 1); });
      });
  }
  return attempt(0);
}

function saveDashCache(d){
  try{
    localStorage.setItem(ADMIN_DASH_CACHE_KEY, JSON.stringify({ at: Date.now(),
      weekRevenue: d.weekRevenue, weekOrders: d.weekOrders, monthly: d.monthly || [],
      yearlyRev: d.yearlyRev, weekCount: d.weekCount }));
  }catch(e){}
}

function loadDashCache(){
  try{ var c = JSON.parse(localStorage.getItem(ADMIN_DASH_CACHE_KEY)||'null'); return c && c.monthly ? c : null; }catch(e){ return null; }
}

function setAdminUpdatedNote(txt){
  var el = $('admin-updated-note');
  if(!el){
    var bar = $('admin-loading-bar'); if(!bar || !bar.parentNode) return;
    el = document.createElement('div'); el.id = 'admin-updated-note';
    el.style.cssText = 'font-size:11px;color:var(--t3);text-align:center;padding:4px 0 0';
    bar.parentNode.insertBefore(el, bar.nextSibling);
  }
  el.textContent = txt || '';
  el.style.display = txt ? '' : 'none';
}

// Some of Lia's actions (publish menu, save schedule, re-engagement emails…) are
// answered at once by the front door and reach the Sheet a moment later. If one is ever
// refused or stuck, say so here rather than let it fail unseen. Health is counts only.
function checkFrontDoorQueue(){
  fetch(APPS_SCRIPT_URL + '?type=health').then(function(r){ return r.json(); }).then(function(h){
    if(!h || h.ok !== true) return;
    var bad = (h.failed || 0) > 0, slow = (h.oldestPendingMin || 0) >= 10;
    // Customers are answered from copies Apps Script pushes (S-017): after every change, and
    // every other quiet hour since gs105. If the pushes stop, they keep seeing an old menu and
    // old streaks, so say so here. 180 min: a normal two-hour gap must not raise an alarm.
    var snaps = h.snapshots || {}, staleMin = 0;
    ['menu', 'loyalty'].forEach(function(k){
      var m = parseInt(snaps[k], 10);
      if(!isNaN(m) && m > staleMin) staleMin = m;
    });
    var stale = staleMin > 180;
    var el = $('admin-queue-warn');
    if(!bad && !slow && !stale){ if(el) el.style.display = 'none'; return; }
    if(!el){
      var bar = $('admin-loading-bar'); if(!bar || !bar.parentNode) return;
      el = document.createElement('div'); el.id = 'admin-queue-warn';
      el.style.cssText = 'margin:8px 12px 0;padding:9px 12px;border-radius:10px;background:#fff3f0;color:#9a3412;font-size:12px;font-weight:700';
      bar.parentNode.insertBefore(el, bar.nextSibling);
    }
    el.textContent = bad
      ? '⚠️ ' + h.failed + ' change' + (h.failed === 1 ? '' : 's') + ' did not reach the Sheet. Tell Tony.'
      : stale
      ? '⚠️ Customers are seeing the menu and rewards as they were ' + Math.round(staleMin / 60) + ' hours ago. Tell Tony.'
      : '⏳ Some changes have been waiting ' + h.oldestPendingMin + ' min for Google. They will keep retrying.';
    el.style.display = '';
  }).catch(function(){});
}

function fetchAdminExtras(){
  if(_adminExtrasFetching || !APPS_SCRIPT_URL) return;
  _adminExtrasFetching = true;
  adminFetchJson(APPS_SCRIPT_URL + '?type=get_dashboard_extra')
    .then(function(extra){
      if(!extra || extra.error) return;
      applyAdminData(extra);
      try{
        var merged = JSON.parse(sessionStorage.getItem('admin_data')||'{}');
        ['intel','react','areas','route','photos'].forEach(function(k){
          if(extra[k] !== undefined) merged[k] = extra[k];
        });
        sessionStorage.setItem('admin_data', JSON.stringify(merged));
      }catch(e){}
    })
    .catch(function(){ /* extras are optional — the panel works without them */ })
    .finally(function(){ _adminExtrasFetching = false; });
}

function refreshAdminData(){
  if(_adminRefreshing) return; // prevent duplicate calls
  if(!APPS_SCRIPT_URL) return;

  // Check session cache first (avoid re-fetching within same session)
  var cached = sessionStorage.getItem('admin_data');
  var cachedTime = parseInt(sessionStorage.getItem('admin_data_time')||'0');
  var AGE_LIMIT = 2 * 60 * 1000; // 2 minutes

  if(cached && Date.now() - cachedTime < AGE_LIMIT){
    applyAdminData(JSON.parse(cached));
    return;
  }

  _adminRefreshing = true;
  showAdminLoading(true);

  // Last known revenue first, clearly labelled, so the Dash is never blank while
  // Google wakes up. The payment split needs this week's orders, so it waits.
  var saved = loadDashCache();
  if(saved){
    applyAdminData(Object.assign({ _fromCache: true }, saved));
    var mins = Math.round((Date.now() - saved.at) / 60000);
    setAdminUpdatedNote('Showing figures from ' + (mins < 60 ? mins + ' min' : Math.round(mins/60) + ' h') + ' ago · updating…');
  } else {
    setAdminUpdatedNote('Loading from the Sheet…');
  }

  // The heavier, less-used sections (intel, reactivation, areas, route, photos) come in
  // a second request so they cannot hold up the orders list. Both start together now:
  // waiting for the first before asking for the second paid Google's delay twice.
  // applyAdminData guards every section with `if(data.X)`, so a partial object only
  // fills in what it has.
  fetchAdminExtras();
  checkFrontDoorQueue();

  adminFetchJson(APPS_SCRIPT_URL + '?type=get_dashboard')
    .then(function(data){
      if(data && !data.error){
        // Keep extras that may have arrived first.
        try{
          var prev = JSON.parse(sessionStorage.getItem('admin_data')||'{}');
          ['intel','react','areas','route','photos'].forEach(function(k){
            if(prev[k] !== undefined && data[k] === undefined) data[k] = prev[k];
          });
        }catch(e){}
        sessionStorage.setItem('admin_data', JSON.stringify(data));
        sessionStorage.setItem('admin_data_time', Date.now().toString());
        saveDashCache(data);
        applyAdminData(data);
        setAdminUpdatedNote('');
        toast('✅ Dashboard updated from Sheet');
      } else {
        setAdminUpdatedNote(saved ? 'Showing saved figures · could not update' : '');
        toast('⚠️ Sheet error: ' + (data&&data.error||'unknown'));
      }
    })
    .catch(function(err){
      console.error('Admin data fetch error:', err.message || err);
      setAdminUpdatedNote(saved ? 'Showing saved figures · Google did not answer, reopen Admin to retry' : '');
      toast('⚠️ Could not reach Sheet: ' + (err.message || 'network error'));
    })
    .finally(function(){
      _adminRefreshing = false;
      showAdminLoading(false);
    });
}

function showAdminLoading(show){
  var el = $('admin-loading-bar');
  if(el) el.style.display = show ? 'block' : 'none';
}

function applyAdminData(data){
  try {
    // Update orders
    // An empty list is real too (a fresh week after Archive), so it replaces the old one.
    if(Array.isArray(data.orders)){
      ORDERS = data.orders;
      buildOrders();
    }
    // Week figures and the KPI cards come only from get_dashboard. get_dashboard_extra
    // (intel/areas/route…) is also fed through here, and used to zero every card:
    // "This week $0 · 0 orders", "All-time $0 · 0 months".
    var isDashboard = data.weekRevenue !== undefined || data.monthly !== undefined;
    if(isDashboard){
    var weekOrdCount = data.weekOrders || (data.orders||[]).length;
    var weekRev2 = data.weekRevenue || 0;
    var today = new Date();
    var dayOfWeek = today.getDay();
    var daysToMonday = (dayOfWeek + 6) % 7;
    var monday = new Date(today);
    monday.setDate(today.getDate() - daysToMonday);
    var weekLabel = 'Week of ' + (monday.getMonth()+1) + '/' + monday.getDate() +
      ' · ' + weekOrdCount + ' Orders · $' + weekRev2;
    var ordSt = $('ord-week-title');
    if(ordSt) ordSt.textContent = weekLabel;
    var menuSt = $('menu-week-title');
    if(menuSt) menuSt.textContent = 'Week of ' + (monday.getMonth()+1) + '/' + monday.getDate();
    if(!data._fromCache && data.lastPublish !== undefined){
      // Keep a just-queued announcement's "sending" note until the server has a newer result.
      var lpNew = data.lastPublish;
      if(!(LAST_PUBLISH && LAST_PUBLISH.pending && (!lpNew || new Date(lpNew.at) < new Date(LAST_PUBLISH.at)))){
        LAST_PUBLISH = lpNew; renderPublishStatus(lpNew);
      }
    }
    if(Array.isArray(data.costs)) buildCostsCard(data.costs, data.costPeriods);
    if(!data._fromCache && !(TEXTS && TEXTS.preview)) buildTextsCard();   // v271: Friday texts
    syncLocalMenuPhotos();   // v274: photos only this phone has
    }

    // Update customers
    if(data.customers && data.customers.length > 0){
      // Map Sheet columns to app format
      CUSTS = data.customers.map(function(c){
        var now = Date.now();
        var days = c.lastTS ? Math.floor((now - c.lastTS) / 86400000) : 999;
        return {
          n:     c.n,
          i:     c.i || (c.n||'??').split(' ').map(function(w){return w[0]||'';}).join('').substring(0,2).toUpperCase(),
          email: c.email,
          phone: c.phone || '',
          addr:  c.addr  || '',
          ltv:   c.ltv   || 0,
          cnt:   c.cnt   || 0,
          last:  c.last  || 'Unknown',
          days:  days,
          risk:  days > 21,
          vip:   (c.ltv||0) > 500,
          // These come from the backend's App Installs lookup. This mapping lists
          // fields explicitly, so anything not named here is silently dropped —
          // which is why the installed count read 0 while the orders view showed
          // the badge correctly.
          installed: !!c.installed,
          platform:  c.platform || ''
        };
      });
      buildCusts();
    }

    // Update monthly chart — data now includes full MONTHLY_DETAIL structure
    if(data.monthly && data.monthly.length > 0){
      MONTHLY        = data.monthly;
      MONTHLY_DETAIL = data.monthly.slice().reverse();

      // Restore cached closed months — override server data with cached values
      // (server may have stale intelligence data; cache has verified correct values)
      var now2 = new Date();
      var thisMonthKey2 = (now2.getMonth()+1) + '/' + now2.getFullYear();
      var cached2 = {};
      try{ cached2 = JSON.parse(localStorage.getItem('monthly_cache')||'{}'); }catch(e){}
      if(Object.keys(cached2).length > 0){
        MONTHLY_DETAIL = MONTHLY_DETAIL.map(function(m){
          var mParts = m.m.split(' ');
          var monthIdx = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(mParts[0]);
          var mYear = parseInt((mParts[1]||'').replace("'",'')) || 0; if(mYear < 100) mYear += 2000;
          var mKey = (monthIdx+1) + '/' + mYear;
          if(mKey !== thisMonthKey2 && cached2[mKey] && cached2[mKey].total > 0){
            return Object.assign({}, cached2[mKey], {weeks: m.weeks}); // keep weeks from server
          }
          return m;
        });
      }

      // Cache all CLOSED months permanently
      MONTHLY_DETAIL.forEach(function(m){
        var mParts = m.m.split(' ');
        var monthIdx = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(mParts[0]);
        var mYear = parseInt(mParts[1]);
        var mKey = (monthIdx+1) + '/' + mYear;
        if(mKey !== thisMonthKey2 && m.total > 0){
          cached2[mKey] = m;
        }
      });
      try{ localStorage.setItem('monthly_cache', JSON.stringify(cached2)); }catch(e){}

      buildDash();

      // Ensure current month exists in MONTHLY_DETAIL — intelligence only has archived weeks
      var now3 = new Date();
      var curMonthLabel = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][now3.getMonth()] + " '" + String(now3.getFullYear()).slice(-2);
      var hasCurMonth = MONTHLY_DETAIL.length > 0 && MONTHLY_DETAIL[0].m === curMonthLabel;
      if(!hasCurMonth){
        // Add placeholder current month row — loadAuditForMonthly will fill with real data
        MONTHLY_DETAIL.unshift({m: curMonthLabel, total:0, food:0, soup:0, salad:0, bakery:0, delivery:0, orders:0, avg_wk:0, avg_ord:0, weeks:[]});
      }

      buildMonthly();
      // get_monthly_detail reads months of week tabs. It used to fire on every dashboard
      // load, competing with the Dash itself; now it runs when the Monthly tab is opened.
      if(_monthlyTabOpened && !data._fromCache) loadAuditForMonthly();
    }

    // Update soup intelligence
    if(data.intel && data.intel.length > 0){
      SOUP_INTEL = data.intel.map(function(s){
        return {
          n:    s.n,
          cat:  s.cat,
          rev:  s.rev,
          weeks: s.weeks,
          avg:  Math.round(s.avg||0),
          last: s.last,
          last_sort: (function(){
            var d = (s.last_date||'').toString().trim();
            if(!d) return 0;
            var p = d.split('/');
            if(p.length===3){var yr=parseInt(p[2]);if(yr<100)yr+=2000;return yr*10000+parseInt(p[0])*100+parseInt(p[1]);}
            var dt=new Date(d);
            if(!isNaN(dt.getTime()))return dt.getFullYear()*10000+(dt.getMonth()+1)*100+dt.getDate();
            return 0;
          })(),
          _as_date: (function(){
            // Find matching ALL_SOUPS entry by fuzzy word match for last_date
            var siW = (s.n||'').toLowerCase().split(/\s+/).filter(function(w){return w.length>3;});
            var as = ALL_SOUPS.find(function(x){return x.n.toLowerCase()===s.n.toLowerCase();})
              || ALL_SOUPS.find(function(x){
                   var xn=x.n.toLowerCase();
                   return siW.filter(function(w){return xn.indexOf(w)>=0;}).length>=Math.min(2,siW.length);
                 });
            return as ? (as.last_date||'') : '';
          })(),
          last_date: (function(){
            var d = (s.last_date || '').toString();
            if(!d) return '';
            // Already formatted nicely (e.g. 'Nov 11, 2025')
            if(/^[A-Z][a-z]+ \d/.test(d)) return d;
            // M/d/yy format
            var parts = d.split('/');
            var months = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            if(parts.length === 3) return (months[parseInt(parts[0])]||parts[0]) + ' ' + parts[1] + " '" + parts[2];
            if(parts.length === 2) return (months[parseInt(parts[0])]||parts[0]) + ' ' + parts[1];
            return d;
          })(),
          trend: s.trend
        };
      });
      // Also update ALL_SOUPS revenue from intel + add any new soups not in the hardcoded list
      SOUP_INTEL.forEach(function(si){
        var siWords = si.n.toLowerCase().split(/\s+/).filter(function(w){return w.length>3;});
        var soup = ALL_SOUPS.find(function(s){ return s.n.toLowerCase() === si.n.toLowerCase(); })
          || ALL_SOUPS.find(function(s){
              var sn = s.n.toLowerCase();
              return siWords.filter(function(w){return sn.indexOf(w)>=0;}).length >= Math.min(2,siWords.length);
             });
        if(soup){
          soup.rev = si.rev;
          if(si.last_date && !soup._intel_date) soup._intel_date = si.last_date;
        } else if(si.n && si.n.length > 1) {
          var cat = si.cat ? si.cat.toLowerCase() : 'soup';
          var em  = cat === 'salad' ? '🥗' : cat === 'bakery' ? '🧁' : '🥣';
          // Clean name — strip anything after common description separators
          var cleanName = si.n.replace(/\s+(this|the|a|an|with|served|has|and|it|is)\s+.*/i, '').trim();
          // Title case
          cleanName = cleanName.split(' ').map(function(w){
            return w.length > 0 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w;
          }).join(' ');
          // Extract description (anything after the name)
          var desc = si.n.length > cleanName.length ? si.n.slice(cleanName.length).trim() : '';
          var newId = 'intel-' + cleanName.toLowerCase().replace(/[^a-z0-9]/g,'-');
          // Check if already exists (avoid duplicates)
          if(!ALL_SOUPS.find(function(s){ return s.n.toLowerCase() === cleanName.toLowerCase(); })){
            ALL_SOUPS.push({
              id: newId, n: cleanName, em: em, cat: cat,
              desc: desc, tags: [], rating: 0, reviews: [],
              rev: si.rev || 0, sz: [{l:'Pint',p:8},{l:'Quart',p:15}],
              al: [], soldout: false, soupId: newId
            });
          }
        }
      });
      buildSoupIntel();
      // Rebuild menu dropdowns so new soups appear immediately
      if(typeof loadFeaturedSelects === 'function') loadFeaturedSelects();
      if(typeof buildMenuBuilder === 'function') buildMenuBuilder();
    }

    // Update reactivation list
    if(data.react && data.react.length > 0){
      REACT = data.react;
      buildReact();
    }

    // Update geo areas
    if(data.areas && data.areas.length > 0){
      AREAS = data.areas;
      buildAreas();
    }


    // Update weekly menu summary
    if(data.wkmenu && data.wkmenu.length > 0){
      WKMENU = data.wkmenu;
      MENU_ITEMS = data.wkmenu.map(function(w, i){
        var fullItem = ALL_SOUPS.find(function(s){ return s.n.toLowerCase() === (w.n||'').toLowerCase(); });
        var cat = (fullItem ? fullItem.cat : null) || w.cat || 'soup';

        var sizes = menuItemSizes(w, fullItem, cat);

        return {
          id:      'm'+(i+1),
          cat:     cat,
          em:      w.em || (fullItem ? fullItem.em : (cat==='salad'?'🥗':cat==='bakery'?'🧁':'🥣')),
          n:       w.n || '',
          desc:    (fullItem && fullItem.desc) || w.desc || '',
          tags:    (fullItem && fullItem.tags) || [],
          sz:      sizes,
          soldout: false,
          al:      (fullItem && fullItem.al) || [],
          soupId:  w.soupId || (fullItem ? fullItem.id : '')
        };
      });
      // Re-apply any locally-saved descriptions (SOUP_INTEL items didn't exist at startup)
      try{
        var _descs=JSON.parse(localStorage.getItem('custom_descs')||'{}');
        MENU_ITEMS.forEach(function(mi){
          var saved=_descs[mi.soupId]||_descs[mi.id]||_descs[mi.n.toLowerCase()]||'';
          if(saved){ mi.desc=saved; var as=ALL_SOUPS.find(function(s){return s.id===mi.soupId;}); if(as) as.desc=saved; }
        });
      }catch(e){}
      buildMenu();
      buildWkMenu();
      // Explicitly fetch photos after menu items are set
      _fetchAndApplyPhotos();
    }

    // Update soup photos from Sheet
    if(data.photos){
      console.log('Dashboard photos received:', Object.keys(data.photos).length, 'keys');
      Object.keys(data.photos).forEach(function(sid){
        var url = data.photos[sid];
        if(!url) return;

        // Clean key — strip description from concatenated intel IDs
        // e.g. "strawberry layered salad this layered salad has..." → "strawberry layered salad"
        var cleanKey = sid.toLowerCase()
          .replace(/^intel-/,'')           // strip intel- prefix
          .replace(/-/g,' ');              // dashes to spaces
        // Stop at first description word
        cleanKey = cleanKey.replace(/\s+(this |the |a |an |with |served |has |and it |it is |is )[a-z].*/i,'').trim();

        // Store under both original and cleaned key
        SOUP_PHOTOS[sid] = url;
        SOUP_PHOTOS[sid.toLowerCase()] = url;
        SOUP_PHOTOS[cleanKey] = url;

        // Find matching MENU_ITEMS entry by name
        MENU_ITEMS.forEach(function(mi){
          var mn = mi.n.toLowerCase();
          var firstWord = mn.split(' ')[0];
          if(mn === cleanKey || mn === sid.toLowerCase() ||
             cleanKey.indexOf(mn) === 0 || mn.indexOf(cleanKey) === 0 ||
             (firstWord.length > 4 && cleanKey.indexOf(firstWord) === 0)){
            var _lu=_uploadedPhotos[mn]; mi.photo=(_lu&&_lu!==url)?_lu:url;
            SOUP_PHOTOS[mn] = mi.photo;
            console.log('Matched photo to menu item:', mi.n, '← key:', sid);
          }
        });

        // Find matching ALL_SOUPS entry
        var soup = ALL_SOUPS.find(function(s){
          var sn = s.n.toLowerCase();
          return s.id === sid || sn === cleanKey || sn === sid.toLowerCase();
        });
        if(soup){ soup.photo = url; SOUP_PHOTOS[soup.n.toLowerCase()] = url; }
      });
      buildMenu();
      buildRepo();
      buildPhotoUploader();
    }

    // Update ALL 8 KPI boxes directly from live data
    if(isDashboard) try {
      var _orders  = data.orders  || [];
      var _monthly = data.monthly || [];
      var _weekRev = data.weekRevenue || 0;
      var _weekOrd = data.weekOrders  || _orders.length;

      // Row 1: This Week + Yearly Revenue
      if($('kpi-week-rev'))    $('kpi-week-rev').textContent    = '$' + Math.round(_weekRev).toLocaleString();
      if($('kpi-week-orders')) $('kpi-week-orders').textContent = _weekOrd + ' orders this week';
      var _yr = _monthly.reduce(function(s,m){return s+(parseFloat(m.total)||0);},0);
      if($('kpi-yearly-rev'))   $('kpi-yearly-rev').textContent   = '$' + Math.round(_yr).toLocaleString();
      if($('kpi-yearly-weeks')) $('kpi-yearly-weeks').textContent = _monthly.length + ' months · all-time';

      // Row 2: Avg Weekly + Subscribers
      var _weeks = (data.weekCount > 10 ? data.weekCount : 0) || Math.round(_monthly.length * 4.33) || 1;
      if($('kpi-avg-weekly')) $('kpi-avg-weekly').textContent = '$' + Math.round(_yr / _weeks).toLocaleString();
      var _best = _monthly.reduce(function(b,m){return (m.total||0)>(b.total||0)?m:b;}, {});
      if($('kpi-avg-best') && _best.m) $('kpi-avg-best').textContent = 'Best: $' + Math.round(_best.total||0).toLocaleString() + ' (' + _best.m + ')';

      // Payment Split (4 boxes) — combine Sheet + local orders. Saved figures carry no
      // orders, so the split waits for the live answer rather than showing zeros.
      if(!data._fromCache){
      var _localOrds = [];
      try{ _localOrds = JSON.parse(localStorage.getItem('submitted_orders')||'[]'); }catch(e){}
      var _allOrds = _orders.concat(_localOrds);
      var _venmo = _allOrds.filter(function(o){return (o.pay||o.payment||'')==='venmo';});
      var _cash  = _allOrds.filter(function(o){return (o.pay||o.payment||'')==='cash';});
      var _vAmt  = _allOrds.length > 0 ? Math.round(_weekRev * _venmo.length / _allOrds.length) : 0;
      var _cAmt  = _allOrds.length > 0 ? Math.round(_weekRev * _cash.length  / _allOrds.length) : 0;
      if($('ps-venmo-cnt')) $('ps-venmo-cnt').textContent = _venmo.length;
      if($('ps-cash-cnt'))  $('ps-cash-cnt').textContent  = _cash.length;
      if($('ps-venmo-amt')) $('ps-venmo-amt').textContent = '$' + _vAmt;
      if($('ps-cash-amt'))  $('ps-cash-amt').textContent  = '$' + _cAmt;
      }

    } catch(e2) { console.error('KPI update error:', e2); }
    if(isDashboard) updateKPICards(data);

    console.log('Admin data refreshed — ' + new Date().toLocaleTimeString());
  } catch(e) {
    console.error('applyAdminData error:', e);
    toast('⚠️ Dashboard error: ' + e.message);
  }
}

function updateKPICards(data) {
  try {
    var orders  = data.orders  || [];
    var monthly = data.monthly || [];

    // Week revenue: use P3 value, fallback to summing order totals from orders array
    var weekRev  = data.weekRevenue || 0;
    var weekOrds = data.weekOrders  || orders.length;

    // If P3 returned 0, estimate from orders (avg $30/order)
    if(weekRev === 0 && orders.length > 0) {
      // Try to get from wkmenu revenue fields
      var wk = data.wkmenu || [];
      wk.forEach(function(item) {
        weekRev += parseFloat((item.rev||'$0').replace('$','')) || 0;
      });
      // Still 0 — use order count estimate
      if(weekRev === 0) weekRev = orders.length * 30;
    }

    // Yearly: sum monthly Grand Totals
    var yearlyRev = monthly.reduce(function(sum, m) {
      return sum + (parseFloat(m.total)||parseFloat(m.r)||0);
    }, 0);

    var weeks = (data.weekCount > 10 ? data.weekCount : 0) || Math.round(monthly.length * 4.33) || 1;
    var avgWeek = weeks > 0 ? Math.round(yearlyRev / weeks) : 0;

    // Best month by total
    var bestMonth = monthly.reduce(function(best, m) {
      var v = parseFloat(m.total)||parseFloat(m.r)||0;
      return (!best || v > (parseFloat(best.total)||parseFloat(best.r)||0)) ? m : best;
    }, null);

    // Payment split — combine Sheet orders + local app orders
    var localOrds = [];
    try{ localOrds = JSON.parse(localStorage.getItem('submitted_orders')||'[]'); }catch(e){}
    var allOrdsForPay = orders.concat(localOrds);
    if(!data._fromCache){
    var venmoOrds = allOrdsForPay.filter(function(o){ return (o.pay||o.payment||'')==='venmo'; });
    var cashOrds  = allOrdsForPay.filter(function(o){ return (o.pay||o.payment||'')==='cash';  });
    var venmoAmt  = allOrdsForPay.length > 0 ? Math.round(weekRev * venmoOrds.length / allOrdsForPay.length) : 0;
    var cashAmt   = allOrdsForPay.length > 0 ? Math.round(weekRev * cashOrds.length  / allOrdsForPay.length) : 0;
    if($('ps-venmo-cnt')) $('ps-venmo-cnt').textContent = venmoOrds.length;
    if($('ps-cash-cnt'))  $('ps-cash-cnt').textContent  = cashOrds.length;
    if($('ps-venmo-amt')) $('ps-venmo-amt').textContent = '$'+venmoAmt;
    if($('ps-cash-amt'))  $('ps-cash-amt').textContent  = '$'+cashAmt;
    }

if ($('kpi-week-rev'))     $('kpi-week-rev').textContent     = '$' + Math.round(weekRev).toLocaleString();
    if ($('kpi-week-orders'))  $('kpi-week-orders').textContent  = weekOrds + ' orders this week';
    if ($('kpi-yearly-rev'))   $('kpi-yearly-rev').textContent   = '$' + Math.round(yearlyRev).toLocaleString();
    if ($('kpi-yearly-weeks')) $('kpi-yearly-weeks').textContent = monthly.length + ' months · all-time';
    if ($('kpi-avg-weekly'))   $('kpi-avg-weekly').textContent   = '$' + avgWeek.toLocaleString();
    if ($('kpi-avg-best') && bestMonth) {
      var bestVal = parseFloat(bestMonth.total)||parseFloat(bestMonth.r)||0;
      $('kpi-avg-best').textContent = 'Best: $' + Math.round(bestVal).toLocaleString() + ' (' + bestMonth.m + ')';
    }
  } catch(e) {
    console.log('KPI update error:', e);
  }
}

function openMonthlyTab(){
  _monthlyTabOpened = true;
  // Refresh at most every 2 minutes; the week summaries behind it are cached server-side.
  if(MONTHLY_DETAIL && MONTHLY_DETAIL.length && Date.now() - _monthlyLoadedAt > 120000) loadAuditForMonthly();
}

function loadAuditForMonthly(){
  if(!APPS_SCRIPT_URL) return;
  _monthlyLoadedAt = Date.now();
  var now = new Date();
  var thisMonthKey = (now.getMonth()+1) + '/' + now.getFullYear();

  adminFetchJson(APPS_SCRIPT_URL + '?type=get_monthly_detail')
    .catch(function(){ return null; })
    .then(function(d){
      if(!d || !d.months) { buildMonthly(); return; }
      MONTHLY_WEEK_DETAIL = d.months;
      if(!MONTHLY_DETAIL) { buildMonthly(); return; }

      MONTHLY_DETAIL.forEach(function(m){
        var mParts   = m.m.split(' ');
        var monthIdx = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(mParts[0]);
        var yrRaw    = (mParts[1]||'').replace("'","");
        var yr       = yrRaw.length === 2 ? parseInt('20' + yrRaw) : parseInt(yrRaw);
        var mKey     = (monthIdx+1) + '/' + yr;
        var detail   = MONTHLY_WEEK_DETAIL[mKey];
        if(!detail) return;

        // Build week drill-down for ALL months (for expand/collapse)
        m.weeks = detail.weeks.map(function(w){
          var orders = w.orders || [];
          var food=0, soup=0, sal=0, oth=0, del=0;
          orders.forEach(function(o){
            food += parseFloat(o.food)||0;
            del  += parseFloat(o.del)||0;
            (o.items||[]).forEach(function(it){
              var price = (parseFloat(it.price)||0)*(parseInt(it.qty)||1);
              var n = (it.name||'').toLowerCase();
              if(n.includes('salad')||n.includes('ceviche')||n.includes('berry crunch')) sal+=price;
              else if(n.includes('muffin')||n.includes('bread')||n.includes('loaf')) oth+=price;
              else soup+=price;
            });
            if(soup===0&&sal===0&&oth===0&&food>0) soup=food;
          });
          return {label:w.label, orders:orders.length, soup:soup, sal:sal, oth:oth, food:food, del:del, total:food+del, _orders:orders};
        });

        // Only override totals for current month — past months use cached intelligence
        var isCached = false;
        try{ var mc=JSON.parse(localStorage.getItem('monthly_cache')||'{}'); isCached=!!(mc[mKey]&&mc[mKey].total>0); }catch(e){}

        if(mKey === thisMonthKey && m.weeks.length > 0){
          m.orders   = m.weeks.reduce(function(s,w){return s+w.orders;},0);
          m.total    = m.weeks.reduce(function(s,w){return s+w.total;},0);
          m.food     = m.weeks.reduce(function(s,w){return s+w.food;},0);
          m.soup     = m.weeks.reduce(function(s,w){return s+(w.soup||0);},0);
          m.salad    = m.weeks.reduce(function(s,w){return s+(w.sal||0);},0);
          m.bakery   = m.weeks.reduce(function(s,w){return s+(w.oth||0);},0);
          m.delivery = m.weeks.reduce(function(s,w){return s+w.del;},0);
          m.avg_ord  = m.orders > 0 ? Math.round(m.total/m.orders) : 0;
          m.avg_wk   = m.weeks.length > 0 ? Math.round(m.total/m.weeks.length) : 0;
        }
      });
      // Rebuild monthly now that current month has live data
      // Also update MONTHLY (bar chart data) with current month's correct total
      if(MONTHLY && MONTHLY.length > 0){
        var lastM = MONTHLY[MONTHLY.length-1];
        var lastMParts = (lastM.m||'').split(' ');
        var lastMIdx = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(lastMParts[0]);
        var lastMKey = (lastMIdx+1) + '/' + (parseInt((lastMParts[1]||'').replace("'","")) + (parseInt((lastMParts[1]||'').replace("'","")) < 100 ? 2000 : 0));
        if(lastMKey === thisMonthKey){
          var curM = MONTHLY_DETAIL && MONTHLY_DETAIL[0];
          if(curM) lastM.r = curM.total || lastM.r;
        }
      }
      buildMonthly();
      buildDash(); // refresh bar chart with updated current month total
    });
}

// ════ ADMIN ════
function adm(sec,btn){
  document.querySelectorAll('.at').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.asec').forEach(s=>s.classList.remove('active'));
  btn.classList.add('active');$('adm-'+sec).classList.add('active');
}

function buildDash(){
  // Before the admin Dash loads there is no revenue to chart (Math.max of nothing is -Infinity).
  if(!MONTHLY.length){ var _r=$('rch'); if(_r) _r.innerHTML='<span style="font-size:12px;color:var(--t3)">Loading…</span>'; }
  var allR=MONTHLY.map(function(m){return m.r||0;});
  var mx=Math.max.apply(null,allR)||3000;
  var mn=Math.min.apply(null,allR.filter(function(r){return r>0;}))||0;
  var base=Math.floor(mn*0.75/500)*500;
  var rng=mx-base||1;

  // SVG bar chart
  var _e=$('rch');
  if(_e && MONTHLY.length){
    var cH=120,cW=22,gap=3,lPad=32,bPad=24,tPad=8;
    var tot=lPad+(cW+gap)*MONTHLY.length;
    var svg='<svg viewBox="0 0 '+tot+' '+(cH+bPad+tPad)+'" width="100%" style="display:block;overflow:visible">';
    // Grid lines
    [0,0.25,0.5,0.75,1].forEach(function(pct){
      var val=base+pct*rng;
      var y=tPad+cH-(pct*cH);
      svg+='<line x1="'+lPad+'" y1="'+y+'" x2="'+(tot-2)+'" y2="'+y+'" stroke="#e5e7eb" stroke-width="1"/>';
      svg+='<text x="'+(lPad-4)+'" y="'+(y+4)+'" text-anchor="end" font-size="9" fill="#999">$'+(val>=1000?(val/1000).toFixed(1)+'k':val)+'</text>';
    });
    // Bars
    MONTHLY.forEach(function(m,i){
      var x=lPad+i*(cW+gap);
      var h=Math.max(2,(m.r-base)/rng*cH);
      var y=tPad+cH-h;
      var isLast=i===MONTHLY.length-1;
      svg+='<rect x="'+x+'" y="'+y+'" width="'+cW+'" height="'+h+'" fill="'+(isLast?'var(--f)':'var(--sgl)')+'" rx="2"/>';
      // Label below
      var parts=(m.m||'').split("'");
      svg+='<text x="'+(x+cW/2)+'" y="'+(tPad+cH+12)+'" text-anchor="middle" font-size="8" fill="#666">'+parts[0].trim()+'</text>';
      svg+='<text x="'+(x+cW/2)+'" y="'+(tPad+cH+21)+'" text-anchor="middle" font-size="8" fill="#999">'+(parts[1]?("'"+parts[1]):'')+'</text>';
    });
    svg+='</svg>';
    _e.innerHTML=svg;
    _e.style.height='auto';
  }

  const top=ALL_SOUPS.filter(s=>s.cat==='soup').sort((a,b)=>b.rev-a.rev).slice(0,8);
  const mxr=top[0]&&top[0].rev||1;
  (function(){var _e=$('bsl');if(_e)_e.innerHTML=top.map((s,i)=>`<li>
    <div class="bsr ${i===0?'top':''}">${i+1}</div>
    <span style="font-size:17px">${s.em}</span>
    <div class="bsi"><strong>${s.n}</strong><span>$${s.rev} total · ${trendArrow(s.rating>=4.7?'📈':s.rev>400?'📉':'⚖️')}</span></div>
    <div class="bsbar"><div class="bsbf" style="width:${s.rev/mxr*100}%;background:${s.rev>600?'var(--f)':s.rev>300?'var(--sg)':'var(--am)'}"></div></div>
  </li>`).join('');})();
}

function loadWeekDetail(tabName, containerId){
  var el = $(containerId);
  if(!el) return;
  el.innerHTML = '<span style="font-size:12px;color:var(--t3)">Loading...</span>';
  fetch(APPS_SCRIPT_URL + '?type=get_week_detail&tab=' + encodeURIComponent(tabName))
    .then(function(r){ return r.json(); })
    .catch(function(){ return null; })
    .then(function(d){
      if(!d || !d.orders || !d.orders.length){
        el.innerHTML = '<span style="font-size:12px;color:var(--t3)">No detail available</span>';
        return;
      }
      el.innerHTML = d.orders.map(function(o){
        var itemStr = (o.items||[]).map(function(it){
          return it.name+(it.size?' ('+it.size+')':'')+(it.qty>1?' x'+it.qty:'')+' $'+(parseFloat(it.price||0)*(parseInt(it.qty)||1)).toFixed(0);
        }).join(' · ');
        return '<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:4px 0;border-top:1px solid #f0f0f0;font-size:11px">'
          +'<div><span style="font-weight:600">'+(o.name||'')+'</span>'
          +(o.addr?' <span style="color:var(--t3)">· '+o.addr+'</span>':'')
          +(o.notes?' <span style="color:var(--t3);font-style:italic"> — '+o.notes+'</span>':'')
          +'<div style="color:var(--t3);margin-top:1px">'+itemStr+'</div></div>'
          +'<div style="text-align:right;flex-shrink:0;margin-left:8px">'
          +'<span style="font-weight:700">$'+parseFloat(o.total||0).toFixed(0)+'</span> '
          +'<span style="color:'+(o.pay==='venmo'?'#1d4ed8':'#555')+';font-weight:600">'+(o.pay==='venmo'?'V':'$')+'</span>'
          +'</div></div>';
      }).join('');
    });
}

function toggleMonthCustomers(id){
  var el = $(id);
  var arr = $(id.replace('mc-','mc-arr-'));
  if(!el) return;
  var open = el.style.display !== 'none';
  el.style.display = open ? 'none' : 'table-row';
  if(arr) arr.textContent = open ? '▶' : '▼';
}

function toggleMonthWeeks(id){
  var el = $(id);
  var idx = id.replace('mw-','');
  var arr = $('mw-arr-'+idx);
  if(!el) return;
  var open = el.style.display !== 'none';
  el.style.display = open ? 'none' : 'table-row';
  if(arr) arr.textContent = open ? '▶' : '▼';
}

// Enrich MONTHLY_DETAIL with weekly breakdowns from audit data
function enrichMonthlyWithWeeks(auditWeeks){
  if(!auditWeeks || !MONTHLY_DETAIL) return;
  var now = new Date();
  MONTHLY_DETAIL.forEach(function(m){
    var mParts   = m.m.split(' ');
    var mName    = mParts[0];
    var mYear    = parseInt((mParts[1]||'').replace("'",'')) || now.getFullYear(); if(mYear < 100) mYear += 2000;
    var monthIdx = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(mName);
    if(monthIdx < 0) return;

    var matchingWeeks = auditWeeks.filter(function(w){
      var label = w.week || '';
      var dateMatch = label.match(/(\d+)\/(\d+)\/(\d+)/);
      if(!dateMatch) return false;
      var wMonth = parseInt(dateMatch[1]) - 1;
      var wYear  = parseInt('20' + dateMatch[3]);
      var wDate  = new Date(wYear, wMonth, parseInt(dateMatch[2]));
      return wMonth === monthIdx && wYear === mYear && wDate <= now;
    });

    m.weeks = matchingWeeks.map(function(w){
      var label = w.week || '';
      var dm = label.match(/(\d+)\/(\d+)\/(\d+)/);
      var wYr = dm ? parseInt('20' + dm[3]) : mYear; // extract year for _year field
      var orders = w.orders || [];
      var food=0, soup=0, sal=0, oth=0, del=0;
      orders.forEach(function(o){
        var f = parseFloat(o.food)||0; food += f;
        del += parseFloat(o.del)||0;
        // Break down by category from items
        (o.items||[]).forEach(function(it){
          var price = (parseFloat(it.price)||0) * (parseInt(it.qty)||1);
          var cat = (it.cat||'').toLowerCase();
          var name = (it.name||'').toLowerCase();
          var size = (it.size||'').toLowerCase();
          // Detect salad by category, name or size label
          if(cat==='salad' || name.includes('salad') || name.includes('ceviche') || name.includes('berry crunch')){
            sal += price;
          } else if(cat==='bakery' || name.includes('muffin') || name.includes('bread') || name.includes('loaf')){
            oth += price;
          } else {
            soup += price;
          }
        });
      });
      // If items breakdown unavailable, use food total as soup
      if(soup===0 && sal===0 && oth===0 && food>0) soup = food;
      return { label: w.week, orders: orders.length, soup: soup, sal: sal, oth: oth, food: food, del: del, total: food+del, _year: wYr };
    });

    // Override any month that has matching audit data — year filter on weeks ensures correct matching
    m.weeks = m.weeks.filter(function(w){ return w._year === mYear; });
    if(m.weeks.length > 0){
      var auditOrders = m.weeks.reduce(function(s,w){ return s+w.orders; }, 0);
      var auditTotal  = m.weeks.reduce(function(s,w){ return s+w.total;  }, 0);
      var auditFood   = m.weeks.reduce(function(s,w){ return s+w.food;   }, 0);
      var auditDel    = m.weeks.reduce(function(s,w){ return s+w.del;    }, 0);
      var auditSoup   = m.weeks.reduce(function(s,w){ return s+(w.soup||0); }, 0);
      var auditSal    = m.weeks.reduce(function(s,w){ return s+(w.sal||0);  }, 0);
      var auditOth    = m.weeks.reduce(function(s,w){ return s+(w.oth||0);  }, 0);

      // Only override totals for the CURRENT month — intelligence engine has correct
      // historical data for past months. Current month isn't in intelligence yet.
      var thisMonth = now.getMonth(); // 0-indexed
      var thisYear  = now.getFullYear();
      var isCurrentMonth = (monthIdx === thisMonth && mYear === thisYear);

      if(isCurrentMonth){
        m.orders   = auditOrders;
        m.total    = auditTotal;
        m.food     = auditFood;
        m.soup     = auditSoup;
        m.salad    = auditSal;
        m.bakery   = auditOth;
        m.misc     = 0;
        m.delivery = auditDel;
        m.avg_ord  = auditOrders > 0 ? Math.round(auditTotal / auditOrders) : 0;
        m.avg_wk   = m.weeks.length > 0 ? Math.round(auditTotal / m.weeks.length) : 0;
      }
      // Always set weeks for drill-down regardless of whether we override totals
    }
  });
}

function buildMonthly(){
  if(!MONTHLY_DETAIL || MONTHLY_DETAIL.length === 0) return;
  var mx=Math.max.apply(null,MONTHLY_DETAIL.map(function(m){return m.total;}));
  var tbody=$('monthly-tbody');
  if(!tbody)return;

  // Update stat cards from live data
  var validMonths = MONTHLY_DETAIL.filter(function(m){ return m.total > 0; });
  if(validMonths.length > 0){
    var best  = validMonths.reduce(function(a,b){ return a.total>b.total?a:b; });
    var worst = validMonths.reduce(function(a,b){ return a.total<b.total?a:b; });
    var totalRev = validMonths.reduce(function(s,m){ return s+m.total; },0);
    var totalDel = validMonths.reduce(function(s,m){ return s+(m.delivery||0); },0);
    if($('mo-best-val'))  $('mo-best-val').textContent  = '$'+Math.round(best.total).toLocaleString();
    if($('mo-best-sub'))  $('mo-best-sub').textContent  = best.m + ' · $'+Math.round(best.avg_wk||0)+'/wk avg';
    if($('mo-worst-val')) $('mo-worst-val').textContent = '$'+Math.round(worst.total).toLocaleString();
    if($('mo-worst-sub')) $('mo-worst-sub').textContent = worst.m + ' · $'+Math.round(worst.avg_wk||0)+'/wk avg';
    if($('mo-total-val')) $('mo-total-val').textContent = '$'+Math.round(totalRev).toLocaleString();
    if($('mo-total-sub')) $('mo-total-sub').textContent = validMonths.length+' months tracked';
    if($('mo-del-val'))   $('mo-del-val').textContent   = '$'+Math.round(totalDel).toLocaleString();
    if($('mo-del-sub'))   $('mo-del-sub').textContent   = 'Since Jan 2026';
  }
  var costs=getGroceryCosts();
  var html='';
  MONTHLY_DETAIL.forEach(function(m,i){
    var cost=costs[m.m]||0;
    var profit=cost>0?m.food-cost:null;
    var margin=cost>0&&m.food>0?Math.round((m.food-cost)/m.food*100):null;
    var hi=m.total===Math.max.apply(null,MONTHLY_DETAIL.map(function(x){return x.total;}));
    var lo=m.total===Math.min.apply(null,MONTHLY_DETAIL.filter(function(x){return x.total>0;}).map(function(x){return x.total;}));
    var bg=i%2===0?'var(--cr)':'#fff';
    var nameStyle=hi?'color:var(--f)':lo?'color:var(--cl)':'';
    var totStyle=hi?'color:var(--f);font-weight:700':lo?'color:var(--cl);font-weight:700':'font-weight:700';
    function c(v){return v>0?'$'+v.toLocaleString():'-';}
    var delCell=m.delivery>0?'<span style="color:#0066cc">$'+m.delivery+'</span>':'<span style="color:var(--t3)">—</span>';
    var profitCell;
    if(profit!==null){
      var pcolor=profit>=0?'var(--sg)':'var(--cl)';
      profitCell='<span style="color:'+pcolor+';font-size:11px;line-height:1.4">$'+profit.toLocaleString()+'<br><small>'+margin+'% margin</small></span>';
    } else {
            profitCell='<button data-m="'+m.m+'" onclick="openGroceryEntry(this.getAttribute(\"data-m\"))" style="font-size:10px;padding:3px 7px;background:var(--cr);border:1px dashed var(--bd);border-radius:6px;cursor:pointer;color:var(--t3)">+ Add cost</button>';
    }
    html+='<tr style="background:'+bg+';font-size:12px">';
    html+='<td style="padding:7px 5px;font-weight:600;'+nameStyle+'">' +
      '<span onclick="toggleMonthWeeks(\'mw-'+i+'\')" style="cursor:pointer;display:flex;align-items:center;gap:4px">' +
        '<span id="mw-arr-'+i+'" style="font-size:9px">▶</span> ' + m.m +
      '</span>' +
    '</td>';
    html+='<td style="padding:7px 5px;text-align:right">'+c(m.soup)+'</td>';
    html+='<td style="padding:7px 5px;text-align:right;color:var(--sg)">'+c(m.salad)+'</td>';
    html+='<td style="padding:7px 5px;text-align:right;color:var(--am)">'+c(m.bakery+m.misc)+'</td>';
    html+='<td style="padding:7px 5px;text-align:right">'+m.orders+'</td>';
    html+='<td style="padding:7px 5px;text-align:right">$'+m.avg_ord+'</td>';
    html+='<td style="padding:7px 5px;text-align:right">$'+m.avg_wk+'</td>';
    html+='<td style="padding:7px 5px;text-align:right">'+delCell+'</td>';
    var dispTotal = (m._auditTotal && m._auditTotal > 0) ? m._auditTotal : m.total;
    html+='<td style="padding:7px 5px;text-align:right;'+totStyle+'">$'+Math.round(dispTotal).toLocaleString()+'</td>';
    html+='<td style="padding:7px 5px;text-align:center">'+profitCell+'</td>';
    html+='</tr>';
    // Weekly breakdown row — hidden by default
    html+='<tr id="mw-'+i+'" style="display:none;background:#f8faf8">';
    html+='<td colspan="10" style="padding:4px 16px 10px">';
    if(m.weeks && m.weeks.length){
      html+='<table style="width:100%;font-size:11px;border-collapse:collapse">';
      html+='<tr style="color:var(--t3);font-weight:700;border-bottom:1px solid #ddd">' +
        '<td style="padding:4px 0">Delivery</td>' +
        '<td style="text-align:right">Orders</td>' +
        '<td style="text-align:right">Soup</td>' +
        '<td style="text-align:right">Salad</td>' +
        '<td style="text-align:right">Other</td>' +
        '<td style="text-align:right">Delivery</td>' +
        '<td style="text-align:right;font-weight:800">Total</td>' +
      '</tr>';
      var wkSoupTot=0, wkSalTot=0, wkOthTot=0, wkDelTot=0, wkOrdTot=0, wkTotTot=0;
      m.weeks.forEach(function(w, wi){
        var soup = w.soup||0, sal = w.sal||0, oth = w.oth||0, del = w.del||0;
        var tot = w.total || w._stubTotal || 0;
        // For stub weeks use revenue from row 3
        if(!w.food && w._stubFood){ del = w._stubDel||0; tot = w._stubTotal||0; }
        wkSoupTot+=soup; wkSalTot+=sal; wkOthTot+=oth; wkDelTot+=del; wkOrdTot+=w.orders||0; wkTotTot+=tot;
        html+='<tr style="border-top:1px solid #f0f0f0;cursor:pointer" onclick="toggleMonthCustomers(\'mc-'+i+'-'+wi+'\')">';
        html+='<td style="padding:4px 0">'+w.label+' <span style="font-size:9px;color:var(--t3)" id="mc-arr-'+i+'-'+wi+'">▶</span></td>';
        html+='<td style="text-align:right">'+(w.orders||0)+'</td>';
        html+='<td style="text-align:right">'+( soup>0 ? '$'+soup.toFixed(0) : '—' )+'</td>';
        html+='<td style="text-align:right;color:var(--sg)">'+( sal>0 ? '$'+sal.toFixed(0) : '—' )+'</td>';
        html+='<td style="text-align:right;color:var(--am)">'+( oth>0 ? '$'+oth.toFixed(0) : '—' )+'</td>';
        html+='<td style="text-align:right;color:#0066cc">$'+del.toFixed(0)+'</td>';
        html+='<td style="text-align:right;font-weight:800">$'+tot.toFixed(0)+'</td>';
        html+='</tr>';
        // Customer detail rows — hidden by default
        var hasDetail = w._orders && w._orders.length > 0 && w._orders[0].name;
        var hasSummary = w._orders && w._orders.length > 0 && !w._orders[0].name;
        html+='<tr id="mc-'+i+'-'+wi+'" style="display:none"><td colspan="7" style="padding:0 8px 8px 16px">';
        if(hasDetail){
          html+=w._orders.map(function(o){
            var itemStr = (o.items||[]).map(function(it){
              return it.name+(it.size?' ('+it.size+')':'')+(it.qty>1?' x'+it.qty:'')+' $'+(parseFloat(it.price||0)*(parseInt(it.qty)||1)).toFixed(0);
            }).join(' · ');
            return '<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:4px 0;border-top:1px solid #f0f0f0;font-size:11px">'
              +'<div><span style="font-weight:600">'+(o.name||'')+'</span>'
              +(o.addr?' <span style="color:var(--t3)">· '+o.addr+'</span>':'')
              +(o.notes?' <span style="color:var(--t3);font-style:italic"> — '+o.notes+'</span>':'')
              +'<div style="color:var(--t3);margin-top:1px">'+itemStr+'</div>'
              // Show how the total was reached: food subtotal plus the delivery fee
              // actually charged, which varies with the customer's loyalty streak.
              +'<div style="color:var(--t3);margin-top:1px">'
                + 'Food $'+(parseFloat(o.food)||0).toFixed(0)
                + ' + delivery ' + ((parseFloat(o.del)||0)===0 ? 'FREE' : '$'+(parseFloat(o.del)||0).toFixed(0))
                + ' = $'+parseFloat(o.total||0).toFixed(0)
              +'</div>'
              // Streak/credits are only supplied for the current week (the Loyalty
              // sheet keeps no per-week history), so past weeks simply omit them.
              +((parseInt(o.streak)||0) > 0
                 ? '<div style="color:var(--f);margin-top:1px;font-weight:600">🔥 Week '+parseInt(o.streak)
                   + ((parseInt(o.credits)||0) > 0 ? ' · 🎟️ '+parseInt(o.credits)+' credit'+((parseInt(o.credits)||0)===1?'':'s') : '')
                   + '</div>'
                 : '')
              +'</div>'
              +'<div style="text-align:right;flex-shrink:0;margin-left:8px">'
              +'<span style="font-weight:700">$'+parseFloat(o.total||0).toFixed(0)+'</span> '
              +'<span style="color:'+(o.pay==='venmo'?'#1d4ed8':'#555')+';font-weight:600">'+(o.pay==='venmo'?'V':'$')+'</span>'
              +'</div></div>';
          }).join('');
        } else {
          // No detail loaded yet — show Load Detail button
          var tabLabel = w.label.replace('Delivered ','').replace(/\/\d+$/,''); // e.g. "5/11"
          html+='<div id="mc-detail-'+i+'-'+wi+'" style="padding:8px 0">'
            +'<button onclick="loadWeekDetail(\''+tabLabel+'\',\'mc-detail-'+i+'-'+wi+'\')" '
            +'style="padding:6px 14px;border-radius:8px;border:1.5px solid var(--f);background:#fff;color:var(--f);font-size:12px;font-weight:600;cursor:pointer">'
            +'Load customer detail</button>'
            +(hasSummary ? ' <span style="font-size:11px;color:var(--t3)">('+w._orders.length+' orders)</span>' : '')
            +'</div>';
        }
        html+='</td></tr>';
      });
      // Totals row
      html+='<tr style="border-top:2px solid #ccc;font-weight:700;background:#f0f7f0">';
      html+='<td style="padding:4px 0">Total</td>';
      html+='<td style="text-align:right">'+wkOrdTot+'</td>';
      html+='<td style="text-align:right">'+( wkSoupTot>0 ? '$'+wkSoupTot.toFixed(0) : '—' )+'</td>';
      html+='<td style="text-align:right;color:var(--sg)">'+( wkSalTot>0 ? '$'+wkSalTot.toFixed(0) : '—' )+'</td>';
      html+='<td style="text-align:right;color:var(--am)">'+( wkOthTot>0 ? '$'+wkOthTot.toFixed(0) : '—' )+'</td>';
      html+='<td style="text-align:right;color:#0066cc">$'+wkDelTot.toFixed(0)+'</td>';
      html+='<td style="text-align:right;font-weight:800;color:var(--f)">$'+wkTotTot.toFixed(0)+'</td>';
      html+='</tr>';
      html+='</table>';
    } else {
      html+='<span style="color:var(--t3);font-size:11px">Loading week data...</span>';
    }
    html+='</td></tr>';
  });
  tbody.innerHTML=html;

  var rc=$('rch-monthly');
  if(rc && MONTHLY_DETAIL && MONTHLY_DETAIL.length){
    var cd=MONTHLY_DETAIL.slice().reverse();
    var maxV=0;
    cd.forEach(function(m){if((m.total||0)>maxV)maxV=m.total;});
    if(!maxV)maxV=3000;
    // Round maxV up to next clean tick
    var tickStep=maxV>3000?1000:500;
    maxV=Math.ceil(maxV/tickStep)*tickStep;
    var tks=[];
    for(var tv=tickStep;tv<=maxV;tv+=tickStep)tks.push(tv);
    var H=200,W=24,gap=4,lp=42,bp=36,tP=14;
    var sw=lp+(W+gap)*cd.length+8;
    var svH=H+bp+tP;
    var o=[];
    o.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+sw+' '+svH+'" width="100%" style="display:block">');
    // Grid lines + labels
    tks.forEach(function(tv){
      var gy=tP+H-Math.round(tv/maxV*H);
      o.push('<line x1="'+lp+'" y1="'+gy+'" x2="'+(sw-4)+'" y2="'+gy+'" stroke="#ebebeb" stroke-width="1"/>');
      var raw=tv/1000;var lb=tv>=1000?'$'+(raw===Math.floor(raw)?Math.floor(raw):raw.toFixed(1))+'k':'$'+tv;
      o.push('<text x="'+(lp-5)+'" y="'+(gy+4)+'" text-anchor="end" font-size="9" fill="#bbb">'+lb+'</text>');
    });
    // Bottom axis
    o.push('<line x1="'+lp+'" y1="'+(tP+H)+'" x2="'+(sw-4)+'" y2="'+(tP+H)+'" stroke="#ccc" stroke-width="1"/>');
    // Bars
    cd.forEach(function(m,i){
      if(!m.total)return;
      var bx=lp+i*(W+gap);
      var tot=m.total;
      var totalBarH=Math.round(tot/maxV*H);
      if(totalBarH<1)return;
      var del=Math.max(0,m.delivery||0);
      var food=Math.max(0,tot-del);
      var salad=Math.max(0,m.salad||0);
      var bakery=Math.max(0,(m.bakery||0)+(m.misc||0));
      var soup=Math.max(0,food-salad-bakery);
      var delH =del >0?Math.round(del /tot*totalBarH):0;
      var salH =salad>0?Math.round(salad/tot*totalBarH):0;
      var bakH =bakery>0?Math.round(bakery/tot*totalBarH):0;
      var soupH=totalBarH-delH-salH-bakH;
      var by=tP+H,sy=by;
      if(soupH>0){sy-=soupH;o.push('<rect x="'+bx+'" y="'+sy+'" width="'+W+'" height="'+soupH+'" fill="#1B3D1C" rx="2"/>');}  
      if(salH>0) {sy-=salH; o.push('<rect x="'+bx+'" y="'+sy+'" width="'+W+'" height="'+salH+'"  fill="#7FAF6E" rx="2"/>');}  
      if(bakH>0) {sy-=bakH; o.push('<rect x="'+bx+'" y="'+sy+'" width="'+W+'" height="'+bakH+'"  fill="#D4943A" rx="2"/>');}  
      if(delH>0) {sy-=delH; o.push('<rect x="'+bx+'" y="'+sy+'" width="'+W+'" height="'+delH+'"  fill="#1d4ed8" rx="2"/>');}  
      // Value label inside bar if tall, above if short
      var lb2='$'+(tot/1000).toFixed(1)+'k';
      var topY=sy;
      var ly=totalBarH>=20?topY+13:Math.max(tP+10,topY-3);
      var lc=totalBarH>=20?'#fff':'#333';
      o.push('<text x="'+(bx+W/2)+'" y="'+ly+'" text-anchor="middle" font-size="8.5" font-weight="bold" fill="'+lc+'">'+lb2+'</text>');
      // Month labels
      var pts=(m.m||'').split("'");
      var xc=bx+W/2;
      o.push('<text x="'+xc+'" y="'+(tP+H+13)+'" text-anchor="middle" font-size="8" fill="#999">'+((pts[0]||'').trim())+'</text>');
      o.push('<text x="'+xc+'" y="'+(tP+H+23)+'" text-anchor="middle" font-size="8" fill="#bbb">'+(pts[1]?"'"+pts[1]:'')+'</text>');
    });
    o.push('</svg>');
    rc.innerHTML=o.join('');
    rc.style.height='auto';
  }
}

function clearLocalOrders(){
  if(!confirm('Clear all app-submitted orders from this device? This only affects what you see here, not the Google Sheet.')) return;
  try{ localStorage.removeItem('submitted_orders'); }catch(e){}
  buildOrders();
  toast('App orders cleared');
}

// S-009 (v253): both "Export CSV" links used to show "Exported!" and make no file. The
// file is built on this phone from what is already loaded; nothing is sent anywhere.
function csvCell(v){
  var s = (v === undefined || v === null) ? '' : String(v);
  if(/^[=+\-@]/.test(s)) s = "'" + s;             // a spreadsheet must not run it as a formula
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function downloadCsv(name, rows){
  var text = '﻿' + rows.map(function(r){ return r.map(csvCell).join(','); }).join('\r\n');
  var url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  var a = document.createElement('a'); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 2000);
}

function csvDate(){ var d = new Date(); return d.getFullYear() + '-' + ('0'+(d.getMonth()+1)).slice(-2) + '-' + ('0'+d.getDate()).slice(-2); }

function exportOrdersCsv(){
  var list = ORDERS || [];
  if(!list.length){ toast('No orders loaded to export'); return; }
  var rows = [['Name','Email','Phone','Address','Items','Food','Delivery','Total','Payment','Invoiced','Notes']];
  list.forEach(function(o){
    var items = o.it || (Array.isArray(o.items) ? o.items.map(function(i){ return i.name + (i.size ? ' (' + i.size + ')' : '') + (i.qty > 1 ? ' x' + i.qty : ''); }).join(', ') : '');
    rows.push([o.name || o.n || '', o.email || '', o.phone || '', o.addr || o.address || '', items,
      o.food, o.del, o.total, o.pay || '', o.delivered ? 'Yes' : 'No', o.notes || o.note || '']);
  });
  downloadCsv('ladle-spoon-orders-' + csvDate() + '.csv', rows);
  toast('📄 ' + list.length + ' orders saved as a CSV file');
}

function exportCustomersCsv(){
  var list = (typeof CUSTS !== 'undefined' && CUSTS) || [];
  if(!list.length){ toast('No customers loaded to export'); return; }
  var rows = [['Name','Email','Phone','Address','Last Order','Orders','Lifetime $']];
  list.forEach(function(c){ rows.push([c.n || '', c.email || '', c.phone || '', c.addr || '', c.last || '', c.cnt || 0, c.ltv || 0]); });
  downloadCsv('ladle-spoon-customers-' + csvDate() + '.csv', rows);
  toast('📄 ' + list.length + ' customers saved as a CSV file');
}

function buildOrders(){
  var localOrders=[];
  try{localOrders=JSON.parse(localStorage.getItem('submitted_orders')||'[]');}catch(e){}
  var allOrders=[...localOrders,...ORDERS];
  ORDER_VIEW = allOrders;
  buildWkMenu();   // Cook & pack follows the orders
  var el=$('ordl'); if(!el) return;

  // Invoices sent so far (S-007). Only Sheet orders carry the flag (gs74+).
  var tally = $('ord-invoice-tally');
  if(tally){
    var billable = ORDERS.filter(function(o){ return o.email; });
    var done = billable.filter(function(o){ return o.delivered; }).length;
    var hasFlag = ORDERS.some(function(o){ return o.delivered !== undefined; });
    tally.style.display = (billable.length && hasFlag) ? '' : 'none';
    tally.textContent = (done === billable.length && done
      ? '🧾 All ' + done + ' invoices sent'
      : '🧾 ' + done + ' of ' + billable.length + ' invoiced');
  }

  // ── Source Tracker ──────────────────────────────────────────
  var tracker = $('order-source-tracker');
  if(tracker && allOrders.length > 0){
    // Split by installed PWA vs ordinary browser. This used to compare app orders
    // against Google Form orders, but the form has been at 0% for weeks — the useful
    // question now is who is ordering from the installed app.
    // Note: `installed` reflects each customer's most recently recorded device, so
    // anyone who hasn't ordered or opened the app since install tracking went live
    // counts as browser until they do.
    var appOrders  = allOrders.filter(function(o){ return !!o.installed; });
    var formOrders = allOrders.filter(function(o){ return !o.installed; });
    var appCount   = appOrders.length;
    var formCount  = formOrders.length;
    var total      = allOrders.length;
    var appPct     = total ? Math.round(appCount/total*100) : 0;
    var formPct    = total ? Math.round(formCount/total*100) : 0;

    // Customers still using form
    var formCustomers = formOrders.map(function(o){ return {n: o.n||o.name||'Unknown', email: o.email||''}; })
      .filter(function(c,i,arr){ return arr.findIndex(function(x){return x.email===c.email;})=== i; });

    tracker.innerHTML =
      '<div class="ccrd" style="margin-bottom:0">' +
        '<div style="font-size:12px;font-weight:700;color:var(--t3);letter-spacing:1px;text-transform:uppercase;margin-bottom:10px">📊 Order Source — This Week</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">' +
          '<div style="background:#f0faf0;border-radius:10px;padding:12px;text-align:center">' +
            '<div style="font-size:28px;font-weight:900;color:var(--f)">' + appCount + '</div>' +
            '<div style="font-size:12px;font-weight:700;color:var(--f)">📱 Installed App</div>' +
            '<div style="font-size:11px;color:var(--t3)">' + appPct + '% of orders</div>' +
          '</div>' +
          '<div style="background:#fef9ec;border-radius:10px;padding:12px;text-align:center">' +
            '<div style="font-size:28px;font-weight:900;color:var(--am)">' + formCount + '</div>' +
            '<div style="font-size:12px;font-weight:700;color:var(--am)">🌐 Browser</div>' +
            '<div style="font-size:11px;color:var(--t3)">' + formPct + '% of orders</div>' +
          '</div>' +
        '</div>' +
        // Progress bar
        '<div style="background:#e5e7eb;border-radius:999px;height:8px;margin-bottom:' + (formCustomers.length ? '12px' : '0') + '">' +
          '<div style="background:var(--f);height:8px;border-radius:999px;width:' + appPct + '%"></div>' +
        '</div>' +
        // Form users list
        (formCustomers.length > 0 ?
          '<div style="font-size:11px;font-weight:700;color:var(--t3);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Ordering From A Browser 👇</div>' +
          formCustomers.map(function(c){
            return '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #f0f0f0;font-size:13px">' +
              '<span>' + esc(c.n) + '</span>' +
              '<span style="font-size:11px;color:var(--t3)">' + esc(c.email) + '</span>' +
            '</div>';
          }).join('') : '') +
      '</div>';
  } else if(tracker) {
    tracker.innerHTML = '';
  }

  // ── Orders List ─────────────────────────────────────────────
  if(allOrders.length===0){el.innerHTML='<div style="text-align:center;padding:30px;color:var(--t3)">No orders yet this week</div>';return;}
  el.innerHTML=allOrders.map(function(o, oi){
    var isApp   = o.source === 'app' || localOrders.indexOf(o) >= 0;
    var isVenmo = (o.pay||o.payment||'') === 'venmo';
    var isDone  = o.delivered === true || o.status==='delivered';
    var stClass = isDone ? 'delivered' : o.status==='confirmed' ? 'confirmed' : 'new';
    var stLabel = isDone ? 'Invoiced ✓' : o.status==='confirmed' ? 'Confirmed'  : 'New';

    // Calculate total including delivery fee
    var foodTotal = 0;
    if(o.total)      foodTotal = parseFloat(o.total) || 0;
    else if(o.tot)   foodTotal = parseFloat(o.tot.toString().replace('$','')) || 0;
    // Free delivery is a real value (0), so don't let || collapse it to 5.
    var _rawDel = (o.del !== undefined && o.del !== null && o.del !== '') ? o.del : o.deliveryFee;
    var delFee  = isNaN(parseFloat(_rawDel)) ? 5 : parseFloat(_rawDel);
    var grandTotal = foodTotal > 0 ? foodTotal : 0;
    // If total doesn't already include delivery, add it
    var totalStr = grandTotal > 0 ? '$' + grandTotal.toFixed(2) : '?';

    // Items display
    var itemsStr = o.it || '';
    if(!itemsStr && Array.isArray(o.items)){
      itemsStr = o.items.map(function(i){
        return i.name + (i.size?' ('+i.size+')':'') + (i.qty>1?' x'+i.qty:'');
      }).join(', ');
    }

    // Comments — check both note and notes fields, strip App Order tag
    var comment = (o.notes || o.note || '').toString().replace(/\[\s*\w+ Order\]/g,'').trim();

    // Itemized breakdown: each line item, then the food subtotal and the actual
    // delivery fee charged (which varies with the customer's loyalty streak), so
    // the total is auditable rather than just a single number.
    var lineRows = '';
    if(Array.isArray(o.items) && o.items.length){
      lineRows = o.items.map(function(i){
        var qty  = parseInt(i.qty)||1;
        var unit = parseFloat(i.price)||0;
        var label = i.name + (i.size?' ('+i.size+')':'') + (qty>1?' × '+qty:'');
        return '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--t3);padding:1px 0">'
             + '<span>'+esc(label)+'</span><span>$'+(unit*qty).toFixed(2)+'</span></div>';
      }).join('');
    }
    var foodSub = parseFloat(o.food);
    if(isNaN(foodSub)) foodSub = Math.max(0, grandTotal - delFee);
    var breakdown = lineRows
      ? '<div style="margin-top:6px;padding-top:6px;border-top:1px dashed #e5e5e5">'
        + lineRows
        + '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--t2);padding:1px 0"><span>Food subtotal</span><span>$'+foodSub.toFixed(2)+'</span></div>'
        + '<div style="display:flex;justify-content:space-between;font-size:11px;color:'+(delFee===0?'var(--f)':'var(--t2)')+';padding:1px 0"><span>Delivery fee</span><span>'+(delFee===0?'FREE':'$'+delFee.toFixed(2))+'</span></div>'
        + '</div>'
      : '';

    // Loyalty streak / credit balance. Backend only supplies these for the CURRENT
    // week — the Loyalty sheet has no per-week history, so past weeks show nothing.
    // Installed PWA vs ordinary browser tab. Recorded per CUSTOMER at order time,
    // so it reflects their most recent known device, not that specific order.
    var deviceBadge = o.installed
      ? '<span style="font-size:10px;background:#e0e7ff;color:#3730a3;border-radius:4px;padding:2px 6px;font-weight:700" title="Ordered from the installed app'+(o.platform?' ('+esc(o.platform)+')':'')+'">📱 Installed</span>'
      : '<span style="font-size:10px;background:#f3f4f6;color:#555;border-radius:4px;padding:2px 6px;font-weight:700" title="Ordered from a browser'+(o.platform?' ('+esc(o.platform)+')':'')+'">🌐 Browser</span>';

    var streak  = parseInt(o.streak)||0;
    var credits = parseInt(o.credits)||0;
    var loyaltyBadge = '';
    if(streak > 0){
      loyaltyBadge += '<span style="font-size:10px;background:#f0faf0;color:#1B3D1C;border-radius:4px;padding:2px 6px;font-weight:700" title="Consecutive weeks ordered">🔥 Week '+streak+(streak>=6?'+ · free delivery':'')+'</span>';
    }
    if(credits > 0){
      loyaltyBadge += '<span style="font-size:10px;background:#fff8e1;color:#92400e;border-radius:4px;padding:2px 6px;font-weight:700;margin-left:4px" title="Referral credits available">🎟️ '+credits+' credit'+(credits===1?'':'s')+'</span>';
    }

    return '<div class="oc">'
      +'<div class="ohd"><strong>'+esc(o.name||o.n||'Unknown')+(o.id?' · '+esc(o.id):'')+'</strong>'
      +'<div style="display:flex;gap:6px;align-items:center">'
      +(isApp
        ?'<span style="font-size:10px;background:#dcfce7;color:#166534;border-radius:4px;padding:2px 6px;font-weight:700">App</span>'
        :'<span style="font-size:10px;background:#fef3c7;color:#92400e;border-radius:4px;padding:2px 6px;font-weight:700">Form</span>')
      +'<span class="sb '+stClass+'">'+stLabel+'</span>'
      +(isVenmo
        ?'<span style="font-size:11px;font-weight:700;color:#1d4ed8">Venmo</span>'
        :'<span style="font-size:11px;font-weight:700;color:#555">Cash</span>')
      +'</div></div>'
      +'<div class="oitm">'+esc(itemsStr)+'</div>'
      +'<div style="margin-top:4px">'+deviceBadge+(loyaltyBadge?' '+loyaltyBadge:'')+'</div>'
      +breakdown
      +'<div class="oft">'
      +'<span class="oad">📍 '+esc(o.addr||o.address||'')+'</span>'
      +'<span class="otl">'+totalStr+'</span>'
      +'</div>'
      +(comment?'<div style="font-size:11px;color:var(--t3);margin-top:4px;font-style:italic">Note: '+esc(comment)+'</div>':'')
      +'<div style="margin-top:6px;text-align:right">'
        +(isDone
          ? '<span style="font-size:11px;font-weight:700;color:var(--f);margin-right:10px">🧾 Invoice sent</span>'
            +'<button class="ord-resend" onclick="markDelivered(this,'+oi+',true)" '
            +'style="padding:4px 10px;border-radius:8px;border:1px solid var(--bd);background:transparent;color:var(--t3);font-size:11px;font-weight:600;cursor:pointer">Resend</button>'
          : '<button class="ord-deliver" onclick="markDelivered(this,'+oi+')" '
            +'style="padding:5px 12px;border-radius:8px;border:1.5px solid var(--f);background:#fff;color:var(--f);font-size:11px;font-weight:700;cursor:pointer">'
            +'✓ Mark Delivered &amp; Send Invoice</button>')
      +'</div>'
      +'</div>';
  }).join('');
}

// Marks the order delivered and emails the customer an invoice. The backend rebuilds
// the invoice from the sheet rather than trusting anything sent from here, so the
// amounts are authoritative. It also refuses duplicates unless resend is confirmed.
// Sends Lia's personal note about installing the app to customers who order from a
// browser. The backend does the filtering (skips anyone already installed or already
// invited) and honours EMAIL_RESERVE, so this can't starve order confirmations.
// Runs a dry run first so Lia sees the count before anything actually sends.
function sendAppInvites(ev){
  if(ev) ev.preventDefault();
  fetch(APPS_SCRIPT_URL, {
    method:'POST',
    body: JSON.stringify({type:'send_app_invites', dryRun:true}),
    headers:{'Content-Type':'text/plain'}
  })
  .then(function(r){ return r.json(); })
  .then(function(d){
    if(!d || !d.success){ toast('Could not check: ' + ((d&&d.error)||'unknown')); return; }
    if(d.sent === 0){ toast('No one to invite — everyone is either installed or already asked.'); return; }
    var msg = 'Send Lia\'s "add the app to your home screen" note to ' + d.sent + ' customer'
            + (d.sent===1?'':'s') + ' who order from a browser?'
            + (d.skipped ? '\n\n' + d.skipped + ' more will be skipped today to stay within the daily email limit.' : '')
            + '\n\nNobody gets this twice.';
    if(!confirm(msg)) return;
    toast('Sending…');
    fetch(APPS_SCRIPT_URL, {
      method:'POST',
      body: JSON.stringify({type:'send_app_invites'}),
      headers:{'Content-Type':'text/plain'}
    })
    .then(function(r){ return r.json(); })
    .then(function(res){
      if(res && res.success) toast('📧 Sent ' + res.sent + ' invitation' + (res.sent===1?'':'s'));
      else toast('Send failed: ' + ((res&&res.error)||'unknown'));
    })
    .catch(function(){ toast('Network error — nothing sent'); });
  })
  .catch(function(){ toast('Network error'); });
}

// S-007 (v253): the order's key (gs74) says WHICH order this is, so a regular's earlier
// weeks and a second order from the same email no longer count as "already invoiced",
// and the list remembers who is done after a reload.
function markDelivered(btn, idx, resend){
  var o = ORDER_VIEW[idx] || {};
  var email = o.email || '';
  if(!email){ toast('No email on that order'); return; }
  if(resend === 'confirmed'){
    // already asked by the "already sent" prompt
  } else if(resend){
    if(!confirm('Send the invoice to ' + email + ' again?')) return;
  } else if(!confirm('Mark this order delivered and email an invoice to ' + email + '?')) return;
  var original = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = 'Sending…';
  var req = {type:'mark_delivered', email:email, tab:'Soup orders', resend:!!resend};
  if(o.key) req.key = o.key;
  fetch(APPS_SCRIPT_URL, {
    method:'POST',
    body: JSON.stringify(req),
    headers:{'Content-Type':'text/plain'}
  })
  .then(function(r){ return r.json(); })
  .then(function(d){
    if(d && d.success){
      toast('📧 Invoice sent to ' + email);
      o.delivered = true;
      if(d.key && !o.key) o.key = d.key;
      rememberDelivered(o.key);
      buildOrders();
    } else if(d && d.already){
      btn.disabled = false; btn.innerHTML = original;
      o.delivered = true; if(d.key && !o.key) o.key = d.key;
      if(confirm('An invoice was already sent for this order. Send it again?')) markDelivered(btn, idx, 'confirmed');
      else buildOrders();
    } else {
      btn.disabled = false; btn.innerHTML = original;
      toast('Could not send: ' + ((d && d.error) || 'unknown error'));
    }
  })
  .catch(function(){
    btn.disabled = false; btn.innerHTML = original;
    toast('Network error — invoice not sent');
  });
}

// The phone's copies of the orders must remember an invoice too, or a tab switch undoes it.
function rememberDelivered(key){
  if(!key) return;
  (ORDERS||[]).forEach(function(c){ if(c.key === key) c.delivered = true; });
  try{
    var cached = JSON.parse(sessionStorage.getItem('admin_data')||'null');
    if(cached && Array.isArray(cached.orders)){
      cached.orders.forEach(function(c){ if(c.key && c.key === key) c.delivered = true; });
      sessionStorage.setItem('admin_data', JSON.stringify(cached));
    }
  }catch(e){}
}

function rtNavApp(){ try{ return localStorage.getItem(RT_NAV_KEY) || 'google'; }catch(e){ return 'google'; } }

function rtSetNav(a){ try{ localStorage.setItem(RT_NAV_KEY, a); }catch(e){} buildRoutePlanner(); if(rtDriveOpen()) renderDrive(); }

function rtMins(sec){
  var m = Math.max(1, Math.round((sec||0)/60));
  return m < 60 ? m + ' min' : Math.floor(m/60) + ' h' + (m%60 ? ' ' + (m%60) + ' min' : '');
}

function rtMiles(m){ var mi = (m||0)/1609.34; return (mi < 10 ? mi.toFixed(1) : Math.round(mi)) + ' mi'; }

function rtMoney(n){ return '$' + (Number(n)||0).toFixed(2); }

function rtPhone(p){ var d = (p||'').replace(/\D/g, ''); if(d.length === 10) d = '1' + d; return d.length === 11 ? '+' + d : ''; }

function rtNavUrl(s){
  if(rtNavApp() === 'waze') return (s.found && isFinite(s.lat))
    ? 'https://waze.com/ul?ll=' + s.lat + ',' + s.lng + '&navigate=yes'
    : 'https://waze.com/ul?q=' + encodeURIComponent(s.a) + '&navigate=yes';
  return 'https://www.google.com/maps/dir/?api=1&travelmode=driving&dir_action=navigate&destination='
    + encodeURIComponent(s.found && s.mapAddr ? s.mapAddr : s.a);
}

function rtSmsUrl(phone, body){ return 'sms:' + rtPhone(phone) + (body ? '?body=' + encodeURIComponent(body) : ''); }

function rtHome(){ return { n: "Lia's Kitchen", a: RT_PLAN.home.a, mapAddr: RT_PLAN.home.a, found: true, lat: RT_PLAN.home.lat, lng: RT_PLAN.home.lng }; }

function rtStop(key){ return RT_PLAN ? RT_PLAN.stops.filter(function(s){ return s.key === key; })[0] : null; }

function rtIdx(key){ return RT_PLAN ? RT_PLAN.stops.map(function(s){ return s.key; }).indexOf(key) : -1; }

// The next stop still to do after `key`: later in the order first, then any she skipped.
function rtNextKey(key){
  var st = RT_PLAN.stops, i = rtIdx(key), d = RT_DRIVE || { done:{}, skipped:{} };
  for(var j = i + 1; j < st.length; j++) if(!d.done[st[j].key] && !d.skipped[st[j].key]) return st[j].key;
  for(var k = 0; k < st.length; k++) if(k !== i && !d.done[st[k].key]) return st[k].key;
  return null;
}

function rtDriveOpen(){ var el = $('drive'); return !!(el && !el.classList.contains('hidden')); }

function rtSaveDrive(){ rtSave(RT_DRIVE_KEY, RT_DRIVE); }

// ── Planning screen ──
function buildRoutePlanner(){
  var el = $('rt-body'); if(!el) return;
  if(BACKEND_GS < 81){
    el.innerHTML = '<div class="rt-card" style="font-size:13px;color:var(--t2);line-height:1.6">Route planning switches on once the '
      + 'backend update (gs81) is live. If it has just been deployed, reload this page.</div>';
    return;
  }
  var nav = rtNavApp(), h = '';
  h += '<div class="rt-card"><div style="font-size:11px;font-weight:800;color:var(--t3);letter-spacing:.5px;margin-bottom:6px">NAVIGATE WITH</div>'
    +  '<div class="rt-seg"><button class="' + (nav === 'google' ? 'on' : '') + '" onclick="rtSetNav(\'google\')">Google Maps</button>'
    +  '<button class="' + (nav === 'waze' ? 'on' : '') + '" onclick="rtSetNav(\'waze\')">Waze</button></div></div>';
  if(RT_PLANNING){
    el.innerHTML = h + '<div class="rt-card" style="text-align:center;font-size:14px;color:var(--t2)">Planning… looking up addresses and asking Google for the best order.</div>';
    return;
  }
  if(!RT_PLAN){
    el.innerHTML = h + '<div class="rt-card"><p style="font-size:13px;color:var(--t2);margin:0 0 12px;line-height:1.5">One tap puts this week\'s orders in the '
      + 'quickest order, starting and ending at the kitchen.</p><button class="rt-big" id="rt-plan-btn" onclick="planRoute()">🧭 Plan Monday\'s route</button></div>'
      + '<div class="rt-status"></div>';
    rtRefreshStatus();
    return;
  }
  var p = RT_PLAN, st = p.stops, d = RT_DRIVE || { done:{}, skipped:{} };
  var left = st.filter(function(s){ return !d.done[s.key]; }).length;
  var cash = st.filter(function(s){ return s.pay === 'cash' && !d.done[s.key]; }).reduce(function(a, s){ return a + (Number(s.total)||0); }, 0);
  h += '<div class="rt-card"><div style="display:flex;gap:14px;flex-wrap:wrap;font-size:13px;color:var(--t2)">'
    +  '<div><strong style="font-size:22px;color:var(--f)">' + st.length + '</strong> stops</div>'
    +  '<div><strong style="font-size:22px;color:var(--f)">' + rtMins(p.totalSec) + '</strong> driving</div>'
    +  '<div><strong style="font-size:22px;color:var(--f)">' + rtMiles(p.totalM) + '</strong></div>'
    +  (cash ? '<div><strong style="font-size:22px;color:var(--f)">' + rtMoney(cash) + '</strong> cash to collect</div>' : '')
    +  '</div><div style="font-size:11px;color:var(--t3);margin-top:6px">Kitchen and back · planned '
    +  new Date(p.planned).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' })
    +  (p.custom ? ' · your order' : ' · best order') + (p.delivered ? ' · ' + p.delivered + ' already delivered' : '') + '</div></div>';
  // gs82: every address that may send her to the wrong door, each with a Look up button.
  var flagged = st.filter(function(s){ return !d.done[s.key] && rtAddrIssue(s); });
  var noAddr = (p.noAddress || []).map(function(x){ return typeof x === 'string' ? { n: x } : x; });
  if(flagged.length || noAddr.length){
    h += '<div class="rt-warn"><strong>Check ' + (flagged.length + noAddr.length === 1 ? 'this address' : 'these addresses') + ' before you go</strong>';
    flagged.concat(noAddr.map(function(x){ return { key: x.key, n: x.n, a: '', noAddr: true }; })).forEach(function(s){
      h += '<div style="display:flex;gap:8px;align-items:center;margin-top:8px"><div style="flex:1;min-width:0"><strong>' + esc(s.n) + '</strong><br>'
        +  (s.noAddr ? 'No address on the order' : esc(s.a) + ' · ' + rtAddrIssue(s)) + '</div>'
        +  (s.key ? rtLookBtn(s.key) : '') + '</div>';
    });
    h += '</div>';
  }
  h += '<div style="font-size:12px;color:var(--t3);margin:0 2px 10px;line-height:1.5">'
    +  (p.textsAuto ? '💬 Texts go out by themselves: "you\'re my next stop" and "delivered".'
                    : '💬 When you tap Delivered, your Messages app opens with "delivered" and "you\'re my next stop" ready. Just tap Send.')
    +  '</div>';
  if(RT_DRIVE && !RT_DRIVE.finished){
    h += '<button class="rt-big go" onclick="openDrive()">▶ Resume — ' + left + ' stop' + (left === 1 ? '' : 's') + ' left</button>';
  } else {
    h += '<button class="rt-big go" onclick="startDrive()"' + (st.length ? '' : ' disabled') + '>▶ Start delivering</button>';
  }
  if(p.moved) h += '<button class="rt-big alt" style="margin-top:8px" onclick="planRoute(true)">Update drive times for my order</button>';
  h += '<div class="rt-card" style="margin-top:12px"><div style="font-size:11px;color:var(--t3);margin-bottom:4px">Use ▲ ▼ to move a stop (for example someone who needs it early).</div>';
  st.forEach(function(s, i){
    var done = !!d.done[s.key];
    h += '<div class="rt-stop"><div class="rt-num ' + (done ? 'done' : !s.found ? 'off' : '') + '">' + (done ? '✓' : i + 1) + '</div>'
      +  '<div class="rt-inf"><strong>' + esc(s.n) + (s.gift ? ' 🎁' : '') + '</strong><span>' + esc(s.a) + '</span>'
      +  '<span>' + esc(s.it || '') + ' · ' + (s.pay === 'cash' ? 'Cash ' : 'Venmo ') + rtMoney(s.total) + '</span>'
      +  (s.found && !p.moved ? '<span>🚗 ' + rtMins(s.legSec) + ' · ' + rtMiles(s.legM) + (i === 0 ? ' from the kitchen' : '') + '</span>' : '')
      +  (s.note ? '<span style="color:var(--cl);font-style:italic">' + esc(s.note) + '</span>' : '')
      +  '</div><div class="rt-mv"><button aria-label="Move up" onclick="rtMove(' + i + ',-1)"' + (i === 0 ? ' disabled' : '') + '>▲</button>'
      +  '<button aria-label="Move down" onclick="rtMove(' + i + ',1)"' + (i === st.length - 1 ? ' disabled' : '') + '>▼</button></div></div>';
  });
  h += '</div><div style="text-align:center;margin-top:4px"><button onclick="planRoute()" style="background:none;border:none;color:var(--f);font-size:13px;font-weight:700;text-decoration:underline;cursor:pointer">'
    +  (p.custom || p.moved ? 'Back to the best order' : 'Plan again (new orders?)') + '</button></div><div class="rt-status"></div>';
  el.innerHTML = h;
  rtRefreshStatus();
}

function planRoute(keepOrder){
  if(RT_PLANNING) return;
  var body = { type:'plan_route' };
  if(keepOrder && RT_PLAN) body.order = RT_PLAN.stops.map(function(s){ return s.key; });
  RT_PLANNING = true; buildRoutePlanner();
  fetch(APPS_SCRIPT_URL, { method:'POST', headers:{ 'Content-Type':'text/plain' }, body: JSON.stringify(body) })
    .then(function(r){ if(!r.ok) throw new Error('Google did not answer'); return r.json(); })
    .then(function(d){
      if(!d || !d.success) throw new Error((d && d.error) || 'no answer');
      rtAdoptPlan(d);
      RT_PLANNING = false; buildRoutePlanner();
      toast('🧭 ' + d.stops.length + ' stops planned · ' + rtMins(d.totalSec) + ' driving');
    })
    .catch(function(e){
      RT_PLANNING = false; buildRoutePlanner();
      toast('Could not plan the route: ' + e.message + '. Try again in a minute.');
    });
}

function rtMove(i, dir){
  var st = RT_PLAN.stops, j = i + dir;
  if(j < 0 || j >= st.length) return;
  var t = st[i]; st[i] = st[j]; st[j] = t;
  RT_PLAN.moved = true; RT_PLAN.custom = true;
  rtSave(RT_PLAN_KEY, RT_PLAN); buildRoutePlanner();
}

// ── Addresses that look wrong: Look up (v260 + gs82) ──
// Why an address may send her to the wrong door, or '' when it looks fine.
function rtAddrIssue(s){
  if(!s.found) return 'Google couldn\'t find it';
  if(s.incomplete) return 'No town or ZIP';
  if(s.check) return 'Google only matched the street';
  return '';
}

// A new plan in the middle of a drive leaves out the stops already delivered; keep them
// at the front so "Stop 3 of 12" still counts the whole day.
function rtAdoptPlan(d){
  if(RT_DRIVE && !RT_DRIVE.finished && RT_PLAN){
    var kept = RT_PLAN.stops.filter(function(s){ return RT_DRIVE.done[s.key] && !d.stops.some(function(x){ return x.key === s.key; }); });
    d.stops = kept.concat(d.stops);
  }
  RT_PLAN = d; rtSave(RT_PLAN_KEY, d);
}

// Look up needs gs82 (gs81 would answer it with a plain re-plan).
function rtLookBtn(key){ return BACKEND_GS >= 82 ? '<button class="rt-look-btn" data-key="' + esc(key) + '" onclick="rtLookup(this.dataset.key)">Look up</button>' : ''; }

function rtLookup(key, q){
  var s = rtStop(key) || ((RT_PLAN && RT_PLAN.noAddress) || []).filter(function(x){ return x.key === key; })[0] || {};
  rtLookShow({ key: key, n: s.n || '', typed: s.a || '', loading: true, q: q || '' });
  var body = { type:'plan_route', action:'lookup', key: key };
  if(q) body.q = q;
  fetch(APPS_SCRIPT_URL, { method:'POST', headers:{ 'Content-Type':'text/plain' }, body: JSON.stringify(body) })
    .then(function(r){ if(!r.ok) throw new Error('Google did not answer'); return r.json(); })
    .then(function(d){ if(!d || !d.success) throw new Error((d && d.error) || 'no answer'); rtLookShow(d); })
    .catch(function(e){ rtLookShow({ key: key, n: s.n || '', typed: s.a || '', q: q || '', error: e.message }); });
}

function rtLookShow(st){
  RT_LOOK = st;
  var el = $('rt-look');
  if(!el){ el = document.createElement('div'); el.id = 'rt-look'; document.body.appendChild(el); }
  el.style.display = 'block';
  var first = (st.n || '').split(' ')[0] || 'them';
  var h = '<div class="dv-top"><span>Find the right address</span><button onclick="rtLookClose()" style="background:#fff;border:1.5px solid var(--bd);border-radius:9px;padding:6px 12px;font-weight:700;cursor:pointer">✕ Close</button></div>'
    + '<div class="dv-name" style="font-size:24px">' + esc(st.n) + '</div>'
    + '<div style="font-size:14px;color:var(--t2);margin-bottom:10px">On the order: <strong>' + (st.typed ? esc(st.typed) : 'no address') + '</strong></div>'
    + '<div style="display:flex;gap:8px;margin-bottom:12px"><input id="rt-look-q" class="fi-sel" value="' + esc(st.q || st.typed || '') + '" placeholder="Type an address to search" '
    + 'style="flex:1;min-width:0;padding:10px;border-radius:10px;border:2px solid var(--bd);font-size:15px" onkeydown="if(event.key===\'Enter\')rtLookSearch()">'
    + '<button class="rt-look-btn" style="padding:10px 14px" onclick="rtLookSearch()">Search</button></div>';
  if(st.loading) h += '<div class="rt-card" style="text-align:center;color:var(--t2)">Looking it up…</div>';
  else if(st.error) h += '<div class="rt-warn">Couldn\'t look it up: ' + esc(st.error) + '. Try again in a minute.</div>';
  else {
    if(st.onFile) h += '<div class="rt-card"><div style="font-size:11px;font-weight:800;color:var(--t3);letter-spacing:.5px;margin-bottom:4px">ADDRESS ON FILE FROM AN EARLIER ORDER</div>'
      + '<div style="font-size:15px;margin-bottom:8px">' + esc(st.onFile) + '</div><button class="rt-big alt" style="padding:10px" onclick="rtUseAddress(-1)">Use this</button></div>';
    var c = st.candidates || [];
    if(c.length) h += '<div style="font-size:12px;color:var(--t3);margin:4px 2px 8px">Google\'s matches near the kitchen. Tap <strong>See on map</strong> to check, then <strong>Use this</strong>.</div>';
    c.forEach(function(x, i){
      h += '<div class="rt-card" style="padding:12px"><div style="font-size:15px;font-weight:700">' + esc(x.a) + '</div>'
        +  '<div style="font-size:12px;margin:3px 0 8px;color:' + (x.house ? '#15803d' : '#b45309') + '">' + (x.house ? 'Exact house' : 'Street only. Check the house number') + (x.mi != null ? '<span style="color:var(--t3)"> · ' + x.mi + ' mi from the kitchen</span>' : '') + '</div>'
        +  '<div class="dv-row" style="margin:0"><a class="rt-big alt" style="padding:10px;font-size:14px" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(x.lat + ',' + x.lng) + '">See on map</a>'
        +  '<button class="rt-big" style="padding:10px;font-size:14px" onclick="rtUseAddress(' + i + ')">Use this</button></div></div>';
    });
    if(!c.length && !st.onFile) h += '<div class="rt-warn">Google found nothing near the kitchen for that. Try adding the town or ZIP, or ask ' + esc(first) + '.</div>';
    if(rtPhone(st.phone)) h += '<a class="rt-big alt" style="margin-top:6px" href="tel:' + rtPhone(st.phone) + '">📞 Call ' + esc(first) + '</a>';
  }
  el.innerHTML = h;
}

function rtLookClose(){ var el = $('rt-look'); if(el) el.style.display = 'none'; RT_LOOK = null; }

function rtLookSearch(){
  var q = (($('rt-look-q') || {}).value || '').trim();
  if(q && RT_LOOK) rtLookup(RT_LOOK.key, q);
}

function rtUseAddress(i){
  var st = RT_LOOK; if(!st) return;
  var pick = i < 0 ? { a: st.onFile } : (st.candidates || [])[i];
  if(!pick || !pick.a) return;
  if(!confirm('Change ' + st.n + '\'s address to:\n\n' + pick.a + '\n\nThis also fixes the order on the Sheet.')) return;
  var body = { type:'plan_route', action:'fix', key: st.key, address: pick.a };
  if(pick.lat != null){ body.lat = pick.lat; body.lng = pick.lng; }
  // Keep her order (and a drive in progress) rather than re-sorting the whole day.
  if(RT_PLAN && (RT_PLAN.custom || RT_PLAN.moved || (RT_DRIVE && !RT_DRIVE.finished))) body.order = RT_PLAN.stops.map(function(s){ return s.key; });
  rtLookShow(Object.assign({}, st, { loading: true }));
  fetch(APPS_SCRIPT_URL, { method:'POST', headers:{ 'Content-Type':'text/plain' }, body: JSON.stringify(body) })
    .then(function(r){ if(!r.ok) throw new Error('Google did not answer'); return r.json(); })
    .then(function(d){
      if(!d || !d.success) throw new Error((d && d.error) || 'no answer');
      rtAdoptPlan(d); rtLookClose(); buildRoutePlanner(); if(rtDriveOpen()) renderDrive();
      toast('📍 Address updated for ' + st.n);
    })
    .catch(function(e){ rtLookShow(Object.assign({}, st, { loading: false, error: e.message })); });
}

// ── Driving screen ──
function openDrive(){ var el = $('drive'); if(el) el.classList.remove('hidden'); renderDrive(); rtRunJobs(); }

function closeDrive(){ var el = $('drive'); if(el) el.classList.add('hidden'); buildRoutePlanner(); }

function rtLegMins(s){ return s && s.found ? Math.max(1, Math.round((s.legSec||0)/60)) : 0; }

function startDrive(){
  if(!RT_PLAN || !RT_PLAN.stops.length) return;
  RT_DRIVE = { started: new Date().toISOString(), done:{}, skipped:{}, tapped:{}, cur: null, prev: null, phase:'stop' };
  RT_DRIVE.cur = RT_PLAN.stops[0].key;
  var first = rtStop(RT_DRIVE.cur);
  if(RT_PLAN.textsAuto) rtQueue({ type:'route_text', texts:[{ kind:'next', key:first.key, mins:rtLegMins(first) }] });
  else if(rtPhone(first.phone)) RT_DRIVE.phase = 'texts';
  rtSaveDrive(); openDrive();
}

function renderDrive(){
  var el = $('drive'); if(!el) return;
  if(!RT_PLAN || !RT_DRIVE){ el.classList.add('hidden'); return; }
  var st = RT_PLAN.stops, d = RT_DRIVE, doneN = st.filter(function(s){ return d.done[s.key]; }).length;
  var top = '<div class="dv-top"><span>' + (d.cur ? 'Stop ' + (doneN + 1) + ' of ' + st.length : 'All ' + st.length + ' stops done') + '</span>'
    + '<button onclick="closeDrive()" style="background:#fff;border:1.5px solid var(--bd);border-radius:9px;padding:6px 12px;font-weight:700;cursor:pointer">✕ Close</button></div>';
  var h = top;
  var s = d.cur ? rtStop(d.cur) : null, prev = d.prev ? rtStop(d.prev) : null;

  if(!s){   // every stop done
    h += '<div class="rt-card" style="text-align:center"><div style="font-size:44px">🎉</div><div class="dv-name">All done!</div>'
      +  '<p style="font-size:14px;color:var(--t2)">' + st.length + ' deliveries. Great job, Lia.</p></div>';
    if(d.phase === 'texts' && prev && rtPhone(prev.phone) && !RT_PLAN.textsAuto) h += rtTextBtn(prev, 'done');
    h += '<a class="rt-big nav" href="' + esc(rtNavUrl(rtHome())) + '" target="_blank" rel="noopener">🏠 Navigate home</a>'
      +  '<button class="rt-big alt" style="margin-top:10px" onclick="finishDrive()">Finish</button>';
  } else if(d.phase === 'texts'){   // texts from Lia's own phone, then on to the stop
    h += '<div class="rt-card">' + (prev ? '<div style="font-size:14px;color:#15803d;font-weight:800;margin-bottom:10px">✓ ' + esc(prev.n) + ' delivered. The invoice is on its way.</div>' : '')
      +  '<div style="font-size:13px;color:var(--t2);margin-bottom:10px">Tap each one, then Send in Messages:</div>';
    if(prev && rtPhone(prev.phone)) h += rtTextBtn(prev, 'done');
    if(rtPhone(s.phone)) h += rtTextBtn(s, 'next'); else h += '<div class="dv-step">No phone number for ' + esc(s.n) + '.</div>';
    h += '</div><a class="rt-big nav" href="' + esc(rtNavUrl(s)) + '" target="_blank" rel="noopener" onclick="rtArrive()">🧭 Navigate to ' + esc(s.n.split(' ')[0]) + '</a>';
  } else {
    var payBox = s.pay === 'cash'
      ? '<div class="dv-pay" style="background:#fef3c7;color:#92400e">💵 Collect ' + rtMoney(s.total) + ' cash</div>'
      : '<div class="dv-pay" style="background:#e8f4ff;color:#0b5cad">💙 Venmo · ' + rtMoney(s.total) + '</div>';
    h += '<div class="dv-name">' + esc(s.n) + (s.gift ? ' 🎁' : '') + '</div>'
      +  '<div class="dv-addr">' + esc(s.a) + (rtAddrIssue(s) ? '<br><span style="color:#dc2626;font-size:13px">' + rtAddrIssue(s) + '.</span> '
           + rtLookBtn(s.key) : '') + '</div>'
      +  (s.note ? '<div class="rt-warn" style="font-size:14px">📝 ' + esc(s.note) + '</div>' : '')
      +  '<div class="rt-card" style="font-size:15px;padding:12px">📦 ' + esc(s.it || '') + '</div>'
      +  payBox
      +  '<a class="rt-big nav" href="' + esc(rtNavUrl(s)) + '" target="_blank" rel="noopener">🧭 Navigate</a>'
      +  '<div class="dv-row">'
      +  (rtPhone(s.phone) ? '<a class="rt-big alt" href="tel:' + rtPhone(s.phone) + '">📞 Call</a><a class="rt-big alt" href="' + esc(rtSmsUrl(s.phone)) + '">💬 Text</a>'
                           : '<div class="dv-step">No phone number on this order.</div>')
      +  '</div>'
      +  '<button class="rt-big go" id="dv-done" style="padding:20px;font-size:18px" onclick="driveDelivered(this)">✓ Delivered</button>'
      +  '<div style="display:flex;justify-content:space-between;margin-top:12px">'
      +  '<button onclick="driveSkip()" style="background:none;border:none;color:var(--t3);font-size:13px;text-decoration:underline;cursor:pointer">Skip for now</button>'
      +  '<span style="font-size:12px;color:var(--t3)">' + (s.found ? '🚗 ' + rtMins(s.legSec) + (rtIdx(s.key) === 0 ? ' from the kitchen' : ' from the last stop') : '') + '</span></div>';
  }
  h += '<div class="rt-status" style="margin-top:14px"></div>';
  el.innerHTML = h;
  rtRefreshStatus();
}

function rtTextBtn(s, kind){
  var tapped = RT_DRIVE.tapped[kind + '|' + s.key];
  var label = kind === 'next' ? 'Text ' + s.n.split(' ')[0] + ': "you\'re my next stop"' : 'Text ' + s.n.split(' ')[0] + ': "delivered"';
  return '<a class="rt-big alt" style="margin-bottom:8px' + (tapped ? ';opacity:.6' : '') + '" href="' + esc(rtSmsUrl(s.phone, kind === 'next' ? s.msgNext : s.msgDone))
    + '" onclick="rtTapped(\'' + kind + '\',' + rtIdx(s.key) + ')">' + (tapped ? '✓ ' : '💬 ') + esc(label) + '</a>';
}

function rtTapped(kind, i){
  var s = RT_PLAN.stops[i]; if(!s) return;
  RT_DRIVE.tapped[kind + '|' + s.key] = true; rtSaveDrive();
  setTimeout(renderDrive, 600);   // after Messages has opened
}

function rtArrive(){ RT_DRIVE.phase = 'stop'; rtSaveDrive(); setTimeout(renderDrive, 600); }

function driveDelivered(btn){
  // Two taps: an invoice email can't be taken back.
  if(!btn.dataset.armed){
    btn.dataset.armed = '1'; btn.textContent = 'Tap again to confirm'; btn.style.background = '#14532d';
    setTimeout(function(){ if(btn.isConnected && btn.dataset.armed){ delete btn.dataset.armed; btn.textContent = '✓ Delivered'; btn.style.background = ''; } }, 4000);
    return;
  }
  var s = rtStop(RT_DRIVE.cur); if(!s) return;
  RT_DRIVE.done[s.key] = true; delete RT_DRIVE.skipped[s.key];
  var nk = rtNextKey(s.key), nxt = nk ? rtStop(nk) : null;
  if(nxt) delete RT_DRIVE.skipped[nxt.key];
  // The "next" text is the one that can't wait, so it goes first; then the invoice.
  if(RT_PLAN.textsAuto){
    var texts = [{ kind:'done', key:s.key }];
    if(nxt) texts.push({ kind:'next', key:nxt.key, mins:rtLegMins(nxt) });
    rtQueue({ type:'route_text', texts:texts });
  }
  rtQueue({ type:'mark_delivered', email:s.email, key:s.key, tab:'Soup orders' }, s.n);
  RT_DRIVE.prev = s.key; RT_DRIVE.cur = nk;
  var phoneTexts = !RT_PLAN.textsAuto && (rtPhone(s.phone) || (nxt && rtPhone(nxt.phone)));
  RT_DRIVE.phase = phoneTexts ? 'texts' : 'stop';
  rtSaveDrive(); renderDrive(); buildRoutePlanner();
  // Straight on to the next stop when the texts need nothing from her.
  if(nxt && !phoneTexts) window.open(rtNavUrl(nxt), '_blank');
}

function driveSkip(){
  var k = RT_DRIVE.cur, nk = rtNextKey(k);
  if(!nk){ toast('This is the last stop left'); return; }
  RT_DRIVE.skipped[k] = true; RT_DRIVE.cur = nk; delete RT_DRIVE.skipped[nk]; RT_DRIVE.phase = 'stop';
  rtSaveDrive(); renderDrive();
  toast('Skipped. It comes back at the end.');
}

function finishDrive(){
  RT_DRIVE.finished = true; rtSaveDrive(); closeDrive();
  var failed = RT_JOBS.filter(function(j){ return j.state === 'failed'; }).length;
  toast(failed ? '⚠️ Route finished. ' + failed + ' item(s) still need attention below.' : '🎉 Route finished.');
}

// ── Sending queue (kept on the phone) ──
function rtQueue(body, label){
  RT_JOBS.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), body: body, label: label || '',
                 tries: 0, state: 'waiting', at: Date.now() });
  rtSave(RT_JOBS_KEY, RT_JOBS); rtRunJobs();
}

// A job that failed waits (job.resting) until its timer runs out. After a reload every
// waiting job starts ready again (the page load clears the flag).
function rtRunJobs(){
  if(RT_BUSY) return;
  var job = RT_JOBS.filter(function(j){ return j.state === 'waiting' && !j.resting; })[0];
  if(!job) return;
  RT_BUSY = true;
  function rest(ms){
    job.resting = true;
    setTimeout(function(){ job.resting = false; rtRunJobs(); }, ms);
  }
  function retry(msg, ms){
    job.tries++; job.error = msg;
    if(job.tries >= 12){ job.state = 'failed'; job.error = 'Google did not answer'; return; }
    rest(ms || RT_JOB_DELAYS[Math.min(job.tries - 1, RT_JOB_DELAYS.length - 1)]);
  }
  fetch(APPS_SCRIPT_URL, { method:'POST', headers:{ 'Content-Type':'text/plain' }, body: JSON.stringify(job.body) })
    .then(function(r){ if(!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function(d){
      if(d && (d.success || d.already)){
        job.state = 'done'; job.at = Date.now(); job.error = '';
        if(job.body.type === 'mark_delivered') rememberDelivered(job.body.key);        if(job.body.type === 'route_text') job.texts = d.texts || [];
      } else if(d && d.noTwilio){
        // Twilio was switched off: from now on her own phone sends them.
        job.state = 'done'; job.at = Date.now(); job.texts = [];
        if(RT_PLAN){ RT_PLAN.textsAuto = false; rtSave(RT_PLAN_KEY, RT_PLAN); }
      } else if(d && d.authRequired){
        job.tries--; retry('Sign in again (PIN) to send this', 30000);   // waiting for her PIN is not a failure
      } else if(d && /still reaching the Sheet/i.test(d.error || '')){
        retry('Waiting for earlier changes');
      } else {
        job.state = 'failed'; job.error = (d && d.error) || 'unknown error';
      }
    })
    .catch(function(){ retry('No answer yet, trying again'); })
    .then(function(){
      RT_BUSY = false; rtSave(RT_JOBS_KEY, RT_JOBS); rtRefreshStatus(); rtRunJobs();
    });
}

function rtRetryJob(id){
  RT_JOBS.forEach(function(j){ if(j.id === id){ j.state = 'waiting'; j.tries = 0; j.resting = false; j.error = ''; } });
  rtSave(RT_JOBS_KEY, RT_JOBS); rtRunJobs(); rtRefreshStatus();
}

function rtRefreshStatus(){
  var inv = RT_JOBS.filter(function(j){ return j.body.type === 'mark_delivered'; });
  var txt = [].concat.apply([], RT_JOBS.filter(function(j){ return j.body.type === 'route_text' && j.state === 'done'; }).map(function(j){ return j.texts || []; }));
  var sent = inv.filter(function(j){ return j.state === 'done'; }).length, wait = inv.filter(function(j){ return j.state === 'waiting'; });
  var failed = RT_JOBS.filter(function(j){ return j.state === 'failed'; });
  var textWait = RT_JOBS.filter(function(j){ return j.body.type === 'route_text' && j.state === 'waiting'; }).length;
  var h = '';
  if(inv.length || textWait || txt.length){
    h += '<div style="font-size:12px;color:var(--t3);line-height:1.6">'
      + (inv.length ? '📧 Invoices: ' + sent + ' sent' + (wait.length ? ' · ' + wait.length + ' sending' : '') : '')
      + (txt.length || textWait ? '<br>💬 Texts: ' + txt.filter(function(t){ return t.status === 'sent' || t.status === 'already'; }).length + ' sent'
          + (textWait ? ' · sending' : '')
          + (txt.some(function(t){ return t.status === 'no_phone'; }) ? ' · some had no phone number' : '')
          + (txt.some(function(t){ return t.status === 'failed'; }) ? ' · some failed' : '') : '')
      + (wait.length && wait[0].error ? '<br>' + esc(wait[0].error) : '')
      + '</div>';
  }
  failed.forEach(function(j){
    h += '<div class="rt-warn" style="margin-top:8px">' + (j.body.type === 'mark_delivered' ? 'Invoice for ' + esc(j.label || j.body.email) : 'Texts')
      + ' didn\'t go: ' + esc(j.error || '') + ' <button onclick="rtRetryJob(\'' + j.id + '\')" style="margin-left:6px;border:none;background:var(--f);color:#fff;border-radius:7px;padding:4px 10px;font-weight:700;cursor:pointer">Retry</button></div>';
  });
  document.querySelectorAll('.rt-status').forEach(function(el){ el.innerHTML = h; });
}

function editItemModal(itemId){
  // Try id match first, then case-insensitive name match
  var item = ALL_SOUPS.find(function(s){ return s.id === itemId; });
  if(!item) item = ALL_SOUPS.find(function(s){ return s.n.toLowerCase() === itemId.toLowerCase(); });
  if(!item){
    // Item is in SOUP_INTEL but not ALL_SOUPS — create a stub so Lia can still edit pricing/details
    var intel = SOUP_INTEL.find(function(s){ return s.n.toLowerCase() === itemId.toLowerCase(); });
    if(intel){
      item = {
        id: itemId, n: intel.n,
        cat: (intel.cat||'Soup').toLowerCase(),
        em: '', desc: '', tags: [], sz: [],
        rev: intel.rev||0, weeks: intel.weeks||1
      };
    }
  }
  if(!item){
    // On this week's menu but not in the catalog (e.g. typed straight into the menu
    // builder) — stub it from the menu entry so its description can still be edited.
    var mi = (MENU_ITEMS||[]).find(function(s){ return (s.n||'').toLowerCase() === itemId.toLowerCase(); });
    if(mi){
      item = { id: itemId, n: mi.n, cat: (mi.cat||'soup').toLowerCase(),
               em: mi.em||'', desc: mi.desc||'', tags: mi.tags||[], sz: mi.sz||[], photo: mi.photo||'' };
    }
  }
  if(!item){ toast('Item not found'); return; }

  // Open the modal and pre-fill
  _aiCat = item.cat || 'soup';
  _aiPhotoData = item.photo || '';
  _aiPhotoUrl  = item.photo || '';  // existing photos are already Cloudinary URLs
  _aiPhotoUploading = false;
  _editingItemId = item.id || item.n; // use id or name as key
  _editingOriginalName = item.n;      // store original name for merge

  var m=$('add-item-modal');
  if(m){ m.style.display='flex'; document.body.style.overflow='hidden'; }

  // Update title
  var title = m ? m.querySelector('h2') : null;
  if(title) title.textContent = '✏️ Edit Item';

  // Fill name, emoji, desc
  var ni=$('ai-name'), ei=$('ai-emoji'), di=$('ai-desc');
  if(ni) ni.value = item.n || '';
  if(ei) ei.value = item.em || '';
  if(di) di.value = item.desc || '';

  // Set category
  selectItemCat(_aiCat);

  // Determine format from existing sz array and pre-fill prices
  var sz = item.sz || [];
  var pf = $('ai-price-fields');
  if(pf && sz.length){
    var l0 = (sz[0].l||'').toLowerCase();
    var l1 = sz.length > 1 ? (sz[1].l||'').toLowerCase() : '';
    var format = 'single';
    if(l0==='pint' || l1==='quart') format='pint-quart';
    else if(l0==='small' || l1==='large') format='small-large';
    else if(l0==='each' && l1==='dozen') format='dozen';
    else if(sz.length > 2) format='custom';
    else if(sz.length === 2) format='custom';

    updatePricingFields(_aiCat, format);

    // Pre-fill price values
    if(format==='pint-quart'){
      var pp=$('ai-price-pint'), pq=$('ai-price-quart');
      if(pp) pp.value = sz[0].p||8;
      if(pq && sz[1]) pq.value = sz[1].p||15;
    } else if(format==='small-large'){
      var ps=$('ai-price-small'), pl=$('ai-price-large');
      if(ps) ps.value = sz[0].p||0;
      if(pl && sz[1]) pl.value = sz[1].p||0;
    } else if(format==='single'){
      var ps2=$('ai-price-single'), pl2=$('ai-price-label');
      if(ps2) ps2.value = sz[0].p||0;
      if(pl2) pl2.value = sz[0].l||'Each';
    } else if(format==='custom'){
      // Re-render custom with existing sizes
      var container=$('ai-custom-sizes');
      if(container){
        container.innerHTML='';
        sz.forEach(function(s,i){
          var div=document.createElement('div');
          div.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:6px';
          div.innerHTML='<div><label style="font-size:11px;color:var(--t3)">Size '+(i+1)+' name</label>'
            +'<input id="ai-size-'+i+'-label" type="text" value="'+(s.l||'')+'" '
            +'style="width:100%;padding:9px;border-radius:8px;border:2px solid #e5e7eb;font-size:14px;box-sizing:border-box;margin-top:3px"></div>'
            +'<div><label style="font-size:11px;color:var(--t3)">Price ($)</label>'
            +'<input id="ai-size-'+i+'-price" type="number" value="'+(s.p||'')+'" '
            +'style="width:100%;padding:9px;border-radius:8px;border:2px solid #e5e7eb;font-size:14px;box-sizing:border-box;margin-top:3px"></div>';
          container.appendChild(div);
        });
      }
    }
  }

  // Photo preview
  var pp=$('ai-photo-preview');
  if(pp) pp.innerHTML = item.photo
    ? '<img src="'+photoUrl(item.photo)+'" style="width:60px;height:60px;border-radius:10px;object-fit:cover">'
    : '📷';
}

function showAddItemModal(){
  _aiCat = 'soup';
  _aiPhotoData = '';
  _aiPhotoUrl  = '';
  _aiPhotoUploading = false;
  _editingItemId = null;
  var m=$('add-item-modal');
  if(m){ m.style.display='flex'; document.body.style.overflow='hidden'; }
  var title = m ? m.querySelector('h2') : null;
  if(title) title.textContent = '➕ Add New Item';
  ['ai-name','ai-emoji','ai-desc'].forEach(function(id){ var el=$(id); if(el) el.value=''; });
  var pp=$('ai-photo-preview'); if(pp) pp.innerHTML='📷';
  selectItemCat('soup');
}

function hideAddItemModal(){
  var m=$('add-item-modal');
  if(m){ m.style.display='none'; document.body.style.overflow=''; }
}

function selectItemCat(cat){
  _aiCat = cat;
  document.querySelectorAll('.ai-cat').forEach(function(b){
    var isSelected = b.dataset.cat === cat;
    b.style.border = isSelected ? '2px solid var(--f)' : '2px solid #e5e7eb';
    b.style.background = isSelected ? 'var(--sgl)' : '#fff';
    b.style.color = isSelected ? 'var(--f)' : '#333';
  });

  // Default selling format by category
  var defaults = {soup:'pint-quart', salad:'single', bakery:'single', other:'single'};
  updatePricingFields(cat, defaults[cat]||'single');

  var emojiMap = {soup:'🥣',salad:'🥗',bakery:'🧁',other:'⭐'};
  var ee=$('ai-emoji'); if(ee && !ee.value) ee.value = emojiMap[cat]||'⭐';
}

function updatePricingFields(cat, format){
  var pf = $('ai-price-fields');
  if(!pf) return;

  // Selling format selector
  var formats = [
    {id:'pint-quart',  label:'Pint & Quart'},
    {id:'small-large', label:'Small & Large'},
    {id:'single',      label:'Single Price'},
    {id:'by-weight',   label:'By Weight (lb)'},
    {id:'each',        label:'Each / Per Item'},
    {id:'dozen',       label:'By the Dozen'},
    {id:'bundle',      label:'Bundle (X for $Y)'},
    {id:'custom',      label:'Custom Sizes'}
  ];

  var btnStyle = 'padding:6px 10px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;border:2px solid #e5e7eb;background:#fff;';
  var html = '<div style="margin-bottom:10px">'
    +'<label style="font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">How is this sold?</label>'
    +'<div style="display:flex;flex-wrap:wrap;gap:6px">'
    + formats.map(function(f){
        var active = f.id === format;
        return '<button type="button" onclick="updatePricingFields(\''+cat+'\',\''+f.id+'\')" '
          +'style="'+btnStyle+(active?'border-color:var(--f);background:var(--sgl);color:var(--f)':'color:#333')+'">'
          +f.label+'</button>';
      }).join('')
    +'</div></div>';

  // Price inputs based on format
  var inp = function(id, label, val, placeholder){
    return '<div><label style="font-size:11px;color:var(--t3)">'+label+'</label>'
      +'<input id="'+id+'" type="number" value="'+(val||'')+'" placeholder="'+(placeholder||'')+'" '
      +'style="width:100%;padding:9px;border-radius:8px;border:2px solid #e5e7eb;font-size:14px;box-sizing:border-box;margin-top:3px"></div>';
  };
  var txtInp = function(id, label, placeholder){
    return '<div><label style="font-size:11px;color:var(--t3)">'+label+'</label>'
      +'<input id="'+id+'" type="text" placeholder="'+(placeholder||'')+'" '
      +'style="width:100%;padding:9px;border-radius:8px;border:2px solid #e5e7eb;font-size:14px;box-sizing:border-box;margin-top:3px"></div>';
  };

  if(format === 'pint-quart'){
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
      + inp('ai-price-pint',  'Pint price ($)', 8)
      + inp('ai-price-quart', 'Quart price ($)', 15)
      +'</div>';
  } else if(format === 'small-large'){
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
      + inp('ai-price-small', 'Small price ($)', '')
      + inp('ai-price-large', 'Large price ($)', '')
      +'</div>';
  } else if(format === 'single'){
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
      + inp('ai-price-single', 'Price ($)', cat==='salad'?15:cat==='bakery'?5:'')
      + txtInp('ai-price-label', 'Unit label', 'e.g. Each, Per item, Serving')
      +'</div>';
  } else if(format === 'by-weight'){
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
      + inp('ai-price-lb', 'Price per lb ($)', '')
      + txtInp('ai-price-label', 'Unit label', 'e.g. Per lb, Per oz')
      +'</div>';
  } else if(format === 'each'){
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
      + inp('ai-price-each', 'Price each ($)', '')
      + inp('ai-price-qty', 'Min qty (optional)', '')
      +'</div>';
  } else if(format === 'dozen'){
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
      + inp('ai-price-each',  'Price each ($)', '')
      + inp('ai-price-dozen', 'Price per dozen ($)', '')
      +'</div>'
      +'<p style="font-size:11px;color:var(--t3);margin-top:4px">Customers can buy individually or save with a dozen price.</p>';
  } else if(format === 'bundle'){
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
      + inp('ai-bundle-qty',   'Bundle size (qty)', '')
      + inp('ai-bundle-price', 'Bundle price ($)', '')
      +'</div>'
      +'<div style="margin-top:8px;display:grid;grid-template-columns:1fr 1fr;gap:8px">'
      + inp('ai-price-each', 'Single price ($)', '')
      + txtInp('ai-price-label', 'Label', 'e.g. 3 for $10')
      +'</div>';
  } else if(format === 'custom'){
    html += '<div id="ai-custom-sizes">'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:6px">'
      + txtInp('ai-size-0-label', 'Size 1 name', 'e.g. Small')
      + inp('ai-size-0-price', 'Price ($)', '')
      +'</div></div>'
      +'<button type="button" onclick="addCustomSize()" style="padding:6px 12px;border-radius:8px;border:1.5px dashed var(--sg);background:transparent;color:var(--f);font-size:12px;font-weight:700;cursor:pointer;margin-top:4px">+ Add another size</button>';
  }

  pf.innerHTML = html;
  // Store format for saveNewItem to read
  pf.dataset.format = format;
}

function addCustomSize(){
  var container = $('ai-custom-sizes');
  if(!container) return;
  var count = container.querySelectorAll('input[id^="ai-size-"]').length / 2;
  var div = document.createElement('div');
  div.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:6px';
  div.innerHTML = '<div><label style="font-size:11px;color:var(--t3)">Size '+(count+1)+' name</label>'
    +'<input id="ai-size-'+count+'-label" type="text" placeholder="e.g. Large" '
    +'style="width:100%;padding:9px;border-radius:8px;border:2px solid #e5e7eb;font-size:14px;box-sizing:border-box;margin-top:3px"></div>'
    +'<div><label style="font-size:11px;color:var(--t3)">Price ($)</label>'
    +'<input id="ai-size-'+count+'-price" type="number" '
    +'style="width:100%;padding:9px;border-radius:8px;border:2px solid #e5e7eb;font-size:14px;box-sizing:border-box;margin-top:3px"></div>';
  container.appendChild(div);
}

function triggerAddItemPhoto(){
  var inp=$('ai-photo-input'); if(inp) inp.click();
}

function handleAddItemPhoto(inp){
  if(!inp.files || !inp.files[0]) return;
  var file = inp.files[0];

  // Show the local preview straight away so the form feels responsive...
  var reader = new FileReader();
  reader.onload = function(e){
    _aiPhotoData = e.target.result;
    var pp=$('ai-photo-preview');
    if(pp) pp.innerHTML='<img src="'+_aiPhotoData+'" style="width:60px;height:60px;border-radius:10px;object-fit:cover">';
  };
  reader.readAsDataURL(file);

  // ...but the preview is NOT the photo. It has to actually reach Cloudinary,
  // otherwise saving stores a multi-MB base64 string (which a Sheets cell can't
  // even hold — 50k char limit) and the menu never sees an image. This upload
  // step was missing entirely, which is why item-editor photos never appeared.
  _aiPhotoUrl = '';
  _aiPhotoUploading = true;
  var statusEl = $('ai-photo-status');
  if(statusEl){ statusEl.textContent = 'Uploading photo…'; statusEl.style.color = 'var(--t3)'; }

  var fd = new FormData();
  fd.append('upload_preset', CLOUDINARY_PRESET);
  fd.append('folder', 'ladle-and-spoon-soups');

  shrinkPhoto(file)
    .then(function(small){ fd.append('file', small); return fetch(CLOUDINARY_URL, {method:'POST', body:fd}); })
    .then(function(r){ return r.json(); })
    .then(function(d){
      _aiPhotoUploading = false;
      if(d && d.secure_url){
        _aiPhotoUrl = d.secure_url;
        if(statusEl){ statusEl.textContent = '✓ Photo uploaded'; statusEl.style.color = 'var(--f)'; }
      } else {
        console.warn('Cloudinary upload failed', d);
        if(statusEl){ statusEl.textContent = 'Photo upload failed — try again'; statusEl.style.color = '#9a3412'; }
      }
    })
    .catch(function(err){
      _aiPhotoUploading = false;
      console.error('Cloudinary upload error', err);
      if(statusEl){ statusEl.textContent = 'Photo upload failed — check your connection'; statusEl.style.color = '#9a3412'; }
    });
}

function saveNewItem(){
  var name = ($('ai-name')||{value:''}).value.trim();
  var em   = ($('ai-emoji')||{value:''}).value.trim() || '⭐';
  var desc = ($('ai-desc')||{value:''}).value.trim();
  if(!name){ toast('Please enter an item name'); $('ai-name').focus(); return; }
  // Saving mid-upload would silently drop the photo — wait for Cloudinary to finish.
  if(_aiPhotoUploading){ toast('⏳ Photo is still uploading — give it a second'); return; }
  // v274: a photo was picked but never reached Cloudinary. Saving used to carry on silently.
  if(_aiPhotoData && !_aiPhotoUrl && !confirm('The photo didn\'t upload, so customers won\'t see it.\n\nTap Cancel to pick the photo again, or OK to save without it.')) return;

  var pf = $('ai-price-fields');
  var format = pf ? pf.dataset.format : 'single';
  var sizes = [];

  if(format === 'pint-quart'){
    var pp = parseFloat(($('ai-price-pint')||{value:'8'}).value)||8;
    var pq = parseFloat(($('ai-price-quart')||{value:'15'}).value)||15;
    sizes = [{l:'Pint',p:pp},{l:'Quart',p:pq}];
  } else if(format === 'small-large'){
    var ps = parseFloat(($('ai-price-small')||{value:''}).value)||0;
    var pl = parseFloat(($('ai-price-large')||{value:''}).value)||0;
    sizes = [{l:'Small',p:ps},{l:'Large',p:pl}];
  } else if(format === 'single'){
    var pSingle = parseFloat(($('ai-price-single')||{value:'0'}).value)||0;
    var lSingle = ($('ai-price-label')||{value:'Each'}).value.trim()||'Each';
    sizes = [{l:lSingle, p:pSingle}];
  } else if(format === 'by-weight'){
    var pLb  = parseFloat(($('ai-price-lb')||{value:'0'}).value)||0;
    var lLb  = ($('ai-price-label')||{value:'Per lb'}).value.trim()||'Per lb';
    sizes = [{l:lLb, p:pLb}];
  } else if(format === 'each'){
    var pEach = parseFloat(($('ai-price-each')||{value:'0'}).value)||0;
    sizes = [{l:'Each', p:pEach}];
  } else if(format === 'dozen'){
    var pEach2  = parseFloat(($('ai-price-each')||{value:'0'}).value)||0;
    var pDozen  = parseFloat(($('ai-price-dozen')||{value:'0'}).value)||0;
    sizes = [];
    if(pEach2)  sizes.push({l:'Each',   p:pEach2});
    if(pDozen)  sizes.push({l:'Dozen',  p:pDozen});
  } else if(format === 'bundle'){
    var bQty    = parseInt(($('ai-bundle-qty')||{value:'3'}).value)||3;
    var bPrice  = parseFloat(($('ai-bundle-price')||{value:'0'}).value)||0;
    var pSingle = parseFloat(($('ai-price-each')||{value:'0'}).value)||0;
    var bLabel  = ($('ai-price-label')||{value:''}).value.trim() || (bQty+' for $'+bPrice);
    sizes = [];
    if(pSingle) sizes.push({l:'Single', p:pSingle});
    if(bPrice)  sizes.push({l:bLabel,   p:bPrice});
  } else if(format === 'custom'){
    var container = $('ai-custom-sizes');
    if(container){
      var i = 0;
      while($('ai-size-'+i+'-label')){
        var lbl = ($('ai-size-'+i+'-label')||{value:''}).value.trim();
        var prc = parseFloat(($('ai-size-'+i+'-price')||{value:'0'}).value)||0;
        if(lbl) sizes.push({l:lbl, p:prc});
        i++;
      }
    }
  }

  // Title-case the name
  name = name.split(' ').map(function(w){
    return w.length > 0 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w;
  }).join(' ');

  var isEditing = !!_editingItemId;
  var itemId = isEditing ? _editingItemId : 'c_' + Date.now();

  // Find the original item to get its original name for merge matching
  var originalItem = isEditing ? (ALL_SOUPS.find(function(s){
    return s.id===itemId || s.n.toLowerCase()===itemId.toLowerCase();
  })) : null;

  var newItem = {
    id: itemId,
    n: name, em: em, cat: _aiCat,
    desc: desc, tags: [], rev: originalItem ? (originalItem.rev||0) : 0,
    rating: originalItem ? (originalItem.rating||0) : 0,
    reviews: originalItem ? (originalItem.reviews||[]) : [],
    sz: sizes,
    // Cloudinary URL only — never the base64 preview (see handleAddItemPhoto)
    photo: _aiPhotoUrl || (originalItem ? (originalItem.photo||'') : ''),
    last_date: originalItem ? (originalItem.last_date||'') : '',
    isCustom: true,
    added: new Date().toISOString(),
    originalName: _editingOriginalName || (originalItem ? originalItem.n : name)  // for merge matching
  };

  if(isEditing){
    // Update in ALL_SOUPS — match by id or name
    var idx = ALL_SOUPS.findIndex(function(s){ return s.id===itemId || s.n.toLowerCase()===itemId.toLowerCase(); });
    if(idx >= 0) ALL_SOUPS[idx] = Object.assign({}, ALL_SOUPS[idx], newItem);
    else ALL_SOUPS.push(newItem);
    // Update or add to _customItems
    var cidx = _customItems.findIndex(function(s){ return s.id===itemId || s.n.toLowerCase()===itemId.toLowerCase(); });
    if(cidx >= 0) _customItems[cidx] = newItem;
    else _customItems.push(newItem);
  } else {
    _customItems.push(newItem);
    ALL_SOUPS.push(newItem);
  }

  try{ localStorage.setItem('custom_items', JSON.stringify(_customItems)); }catch(e){}
  _editingItemId = null;

  hideAddItemModal();
  buildSoupIntel();
  initMenuBuilder();
  toast((isEditing ? '✅ ' + name + ' updated!' : '✅ ' + name + ' added!'));

  fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify({type:'save_custom_item', item:newItem}),
    headers:{'Content-Type':'text/plain'}
  }).catch(function(){});

  // The menu renders photos from the "Soup Photos" tab, NOT from the item record,
  // so a photo also has to be written there or it will never show on a menu card.
  if(newItem.photo){
    SOUP_PHOTOS[newItem.n] = newItem.photo;
    try{
      var _lp = JSON.parse(localStorage.getItem('soup_photos')||'{}');
      _lp[newItem.n]  = newItem.photo;
      _lp[newItem.id] = newItem.photo;
      localStorage.setItem('soup_photos', JSON.stringify(_lp));
    }catch(e){}
    fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({type:'save_photo', soupId:newItem.id, url:newItem.photo, name:newItem.n}),
      headers:{'Content-Type':'text/plain'}
    }).catch(function(){ toast('⚠️ Photo not saved for customers yet. It will retry next time you open Admin.'); });
  }
}

function editItemDesc(itemId){
  // Find item in MENU_ITEMS and ALL_SOUPS
  var mi = MENU_ITEMS.find(function(i){return i.id===itemId;});
  if(!mi) return;
  var as = ALL_SOUPS.find(function(s){return s.id===mi.soupId||s.id===itemId;});
  var currentDesc = mi.desc || (as?as.desc:'') || '';
  var newDesc = prompt('Edit description for ' + mi.n + ':', currentDesc);
  if(newDesc === null) return; // cancelled
  newDesc = newDesc.trim();
  // Update in MENU_ITEMS
  mi.desc = newDesc;
  // Update in ALL_SOUPS
  if(as) as.desc = newDesc;
  // Update display
  var el=document.getElementById('item-desc-'+itemId);
  if(el) el.innerHTML = newDesc || '<em style="color:#999">Tap to add description...</em>';
  // Save to localStorage
  try{
    var descs = JSON.parse(localStorage.getItem('custom_descs')||'{}');
    if(mi.soupId) descs[mi.soupId] = newDesc;
    descs[itemId] = newDesc;
    descs[mi.n.toLowerCase()] = newDesc;
    localStorage.setItem('custom_descs', JSON.stringify(descs));
  }catch(e){}
  buildMenu();
  toast('✅ Description saved');
}

// ════ PHOTO MIGRATION ════
function migratePhotosToCloudinary(){
  var statusEl = $('migrate-status');
  // Find all soups with base64 photos in SOUP_PHOTOS
  var toMigrate = [];
  Object.keys(SOUP_PHOTOS).forEach(function(name){
    var url = SOUP_PHOTOS[name];
    if(url && url.startsWith('data:image')){
      // Find matching soup in ALL_SOUPS
      var soup = ALL_SOUPS.find(function(s){ return s.n.toLowerCase() === name; });
      toMigrate.push({name:name, sid: soup ? soup.id : name, dataUrl: url});
    }
  });

  if(toMigrate.length === 0){
    if(statusEl) statusEl.textContent = '✅ All photos already on Cloudinary!';
    toast('✅ Nothing to migrate');
    return;
  }

  if(statusEl) statusEl.textContent = '⏳ Migrating ' + toMigrate.length + ' photos... (0/' + toMigrate.length + ')';
  toast('☁️ Starting migration of ' + toMigrate.length + ' photos...');

  var done = 0, failed = 0;

  function uploadNext(idx){
    if(idx >= toMigrate.length){
      var msg = '✅ Migration complete! ' + done + ' uploaded, ' + failed + ' failed.';
      if(statusEl) statusEl.textContent = msg;
      toast(msg);
      buildPhotoUploader();
      buildRepo();
      buildMenu();
      return;
    }

    var item = toMigrate[idx];
    if(statusEl) statusEl.textContent = '⏳ Uploading ' + (idx+1) + '/' + toMigrate.length + ': ' + item.name + '...';

    // Convert base64 dataURL to blob
    try{
      var parts = item.dataUrl.split(',');
      var mime  = parts[0].match(/:(.*?);/)[1];
      var raw   = atob(parts[1]);
      var arr   = new Uint8Array(raw.length);
      for(var i=0;i<raw.length;i++) arr[i] = raw.charCodeAt(i);
      var blob  = new Blob([arr], {type:mime});
      var ext   = mime.split('/')[1] || 'jpg';

      var fd = new FormData();
      fd.append('file', blob, 'soup_' + item.sid + '.' + ext);
      fd.append('upload_preset', CLOUDINARY_PRESET);
      fd.append('folder', 'ladle-and-spoon-soups');
      fd.append('public_id', 'soup_' + item.sid);

      fetch(CLOUDINARY_URL, {method:'POST', body:fd})
        .then(function(r){ return r.json(); })
        .then(function(d){
          if(d.secure_url){
            var url = d.secure_url;
            // Replace base64 with Cloudinary URL in SOUP_PHOTOS
            SOUP_PHOTOS[item.name] = url;
            // Update ALL_SOUPS
            var soup = ALL_SOUPS.find(function(s){ return s.id===item.sid; });
            if(soup) soup.photo = url;
            // Update localStorage
            try{
              var lp = JSON.parse(localStorage.getItem('soup_photos')||'{}');
              lp[item.name] = url;
              lp[item.sid]  = url;
              localStorage.setItem('soup_photos', JSON.stringify(lp));
            }catch(e){}
            // Save to Sheet
            fetch(APPS_SCRIPT_URL, {
              method:'POST',
              body: JSON.stringify({type:'save_photo', soupId:item.sid, url:url, name:item.name}),
              headers:{'Content-Type':'text/plain'}
            }).catch(function(){});
            done++;
          } else {
            console.warn('Migration failed for', item.name, d);
            failed++;
          }
          // Small delay between uploads to avoid rate limiting
          setTimeout(function(){ uploadNext(idx+1); }, 300);
        })
        .catch(function(err){
          console.error('Migration error for', item.name, err);
          failed++;
          setTimeout(function(){ uploadNext(idx+1); }, 300);
        });
    } catch(err){
      console.error('Blob error for', item.name, err);
      failed++;
      setTimeout(function(){ uploadNext(idx+1); }, 100);
    }
  }

  uploadNext(0);
}

// Category-based fallback sizes — used whenever an ALL_SOUPS entry doesn't
// define its own `sz` array (which is most items; only specially-priced
// items like Jambalaya or Shrimp Ceviche override this).
function _defaultSizesForItem(item){
  if(item && item.sz && item.sz.length) return item.sz;
  var cat = item ? item.cat : 'soup';
  if(cat === 'salad')  return [{l:'Single', p:15}];
  if(cat === 'bakery') return [{l:'Each',   p:5}];
  if(cat === 'other')  return [{l:'Single', p:15}];
  return [{l:'Pint', p:8}, {l:'Quart', p:15}]; // soup default
}

function _resolveSlotId(val){
  if(!val) return '';
  var id   = typeof val === 'object' ? val.id : val;
  var name = typeof val === 'object' ? val.n  : '';
  var item = ALL_SOUPS.find(function(s){ return s.id === id; });
  if(item) return item.id;
  if(name){
    item = ALL_SOUPS.find(function(s){ return s.n.toLowerCase() === name.toLowerCase(); });
    if(item) return item.id;
  }
  return '';
}

function initMenuBuilder(){
  try{ _menuSelections = JSON.parse(localStorage.getItem('menu_builder')||'{"items":[],"soups":[],"salads":[]}'); }catch(e){}
  var container = $('menu-all-slots');
  if(!container) return;
  container.innerHTML = '';

  // Load from unified items array first, fall back to legacy soups/salads arrays
  var toLoad = _menuSelections.items && _menuSelections.items.length
    ? _menuSelections.items
    : [].concat(
        (_menuSelections.soups  ||[]).map(function(v){ return typeof v==='object'?v:{id:v,cat:'soup'}; }),
        (_menuSelections.salads ||[]).map(function(v){ return typeof v==='object'?v:{id:v,cat:'salad'}; }),
        (_menuSelections.bakery ||[]).map(function(v){ return typeof v==='object'?v:{id:v,cat:'bakery'}; }),
        (_menuSelections.other  ||[]).map(function(v){ return typeof v==='object'?v:{id:v,cat:'other'}; })
      );

  if(toLoad.length === 0){
    // Start with one empty slot
    _addSlotHTML('any', '');
  } else {
    toLoad.forEach(function(val){
      var id = _resolveSlotId(val);
      _addSlotHTML('any', id);
    });
  }
}

function _addSlotHTML(type, selectedId){
  var container = $('menu-all-slots');
  if(!container){
    var slotMap = {soup:'menu-soup-slots',salad:'menu-salad-slots',bakery:'menu-bakery-slots',other:'menu-other-slots',any:'menu-all-slots'};
    container = $(slotMap[type] || 'menu-all-slots');
  }
  if(!container) return;

  var idx    = container.querySelectorAll('.menu-slot').length;
  var items  = ALL_SOUPS.slice().sort(function(a,b){ return a.n.localeCompare(b.n); });
  var selectedItem  = selectedId ? items.find(function(s){ return s.id === selectedId; }) : null;
  var selectedLabel = selectedItem ? selectedItem.em + ' ' + selectedItem.n : '';
  var slotId = 'mslot-any-' + idx + '-' + Date.now();

  // Get default prices for selected item
  var _defSz  = _defaultSizesForItem(selectedItem);
  var defP1   = _defSz[0] ? _defSz[0].p : '';
  var defP2   = _defSz[1] ? _defSz[1].p : '';
  var defLbl1 = _defSz[0] ? _defSz[0].l : 'Pint';
  var defLbl2 = _defSz[1] ? _defSz[1].l : '';

  var div = document.createElement('div');
  div.className = 'menu-slot';
  div.style.cssText = 'margin-bottom:8px;background:var(--cr);border-radius:12px;padding:10px;border:1px solid var(--bd)';
  div.dataset.type  = selectedItem ? selectedItem.cat : 'soup';
  div.dataset.idx   = idx;
  div.dataset.value = selectedId || '';

  div.innerHTML =
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
      '<div style="flex:1;position:relative">' +
        '<input id="'+slotId+'-inp" type="text" value="'+selectedLabel+'" placeholder="Search items..." autocomplete="off" ' +
          'style="width:100%;padding:9px 12px;border-radius:10px;border:2px solid var(--bd);font-size:14px;box-sizing:border-box;background:#fff" ' +
          'oninput="_filterSlot(this,\''+slotId+'\')" ' +
          'onfocus="_openSlotDropdown(this,\''+slotId+'\')" ' +
          'onblur="_closeSlotDropdown(\''+slotId+'\')" ' +
        '>' +
        '<div id="'+slotId+'-dd" style="display:none;position:absolute;top:100%;left:0;right:0;background:#fff;border:2px solid var(--bd);border-radius:10px;max-height:220px;overflow-y:auto;z-index:999;box-shadow:0 4px 12px rgba(0,0,0,0.15)">' +
          items.map(function(s){
            var catLabel = s.cat === 'salad' ? ' (Salad)' : s.cat === 'bakery' ? ' (Bakery)' : s.cat === 'other' ? ' (Other)' : '';
            return '<div onmousedown="_selectSlotItem(event,\''+slotId+'\',\''+s.id+'\',\''+s.em+' '+s.n.replace(/'/g,"\\'")+'\',\''+s.cat+'\')" ' +
              'ontouchend="_selectSlotItem(event,\''+slotId+'\',\''+s.id+'\',\''+s.em+' '+s.n.replace(/'/g,"\\'")+'\',\''+s.cat+'\')" ' +
              'style="padding:10px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid #f0f0f0" ' +
              'onmouseover="this.style.background=\'#f0f7f0\'" onmouseout="this.style.background=\'#fff\'">' +
              s.em + ' ' + s.n + '<span style="font-size:10px;color:#999;margin-left:4px">'+catLabel+'</span></div>';
          }).join('') +
        '</div>' +
      '</div>' +
      '<button onclick="_removeSlot(this)" style="padding:6px 10px;border-radius:8px;border:none;background:#fee2e2;color:#e53e3e;font-size:14px;cursor:pointer;flex-shrink:0">✕</button>' +
    '</div>' +
    // Price override row — sizes and prices are both editable here, every week,
    // regardless of what the catalog default is for this item.
    '<div id="'+slotId+'-prices" style="display:'+(selectedItem?'flex':'none')+';align-items:center;gap:6px;flex-wrap:wrap">' +
      '<span style="font-size:11px;color:var(--t3);font-weight:600">This week\'s sizes:</span>' +
      '<div style="display:flex;align-items:center;gap:4px">' +
        '<input id="'+slotId+'-lbl1" type="text" value="'+defLbl1+'" placeholder="Pint" ' +
          'style="width:58px;padding:4px 6px;border-radius:6px;border:1px solid var(--bd);font-size:11px;text-align:center" ' +
          'onchange="_saveMenuSelections()" title="Size label">' +
        '<span style="font-size:11px;color:var(--t3)">$</span>' +
        '<input id="'+slotId+'-p1" type="number" min="1" max="99" step="0.5" placeholder="'+defP1+'" ' +
          'style="width:52px;padding:4px 6px;border-radius:6px;border:1px solid var(--bd);font-size:13px;font-weight:700;text-align:center" ' +
          'title="Leave blank to use default price">' +
      '</div>' +
      '<div id="'+slotId+'-p2wrap" style="display:'+(defLbl2?'flex':'none')+';align-items:center;gap:4px">' +
        '<input id="'+slotId+'-lbl2" type="text" value="'+defLbl2+'" placeholder="Quart" ' +
          'style="width:58px;padding:4px 6px;border-radius:6px;border:1px solid var(--bd);font-size:11px;text-align:center" ' +
          'onchange="_saveMenuSelections()" title="Size label">' +
        '<span style="font-size:11px;color:var(--t3)">$</span>' +
        '<input id="'+slotId+'-p2" type="number" min="1" max="99" step="0.5" placeholder="'+defP2+'" ' +
          'style="width:52px;padding:4px 6px;border-radius:6px;border:1px solid var(--bd);font-size:13px;font-weight:700;text-align:center" ' +
          'title="Leave blank to use default price">' +
        '<button type="button" onclick="_toggleSlotSize(\''+slotId+'\',false)" ' +
          'style="padding:3px 7px;border-radius:6px;border:none;background:#fee2e2;color:#e53e3e;font-size:11px;cursor:pointer" title="Remove this size">✕</button>' +
      '</div>' +
      '<button type="button" id="'+slotId+'-addsz" onclick="_toggleSlotSize(\''+slotId+'\',true)" ' +
        'style="display:'+(defLbl2?'none':'inline-block')+';padding:3px 8px;border-radius:6px;border:1.5px dashed var(--sg);background:transparent;color:var(--f);font-size:11px;font-weight:700;cursor:pointer">' +
        '+ 2nd size</button>' +
      '<span style="font-size:10px;color:var(--t3);font-style:italic">blank = default</span>' +
    '</div>';

  container.appendChild(div);
}

function _filterSlot(inp, slotId){
  var dd    = document.getElementById(slotId + '-dd');
  var q     = inp.value.toLowerCase();
  if(!dd) return;
  dd.style.display = 'block';
  Array.from(dd.children).forEach(function(item){
    item.style.display = item.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

function _openSlotDropdown(inp, slotId){
  var dd = document.getElementById(slotId + '-dd');
  if(dd){ dd.style.display = 'block'; inp.select(); }
}

function _closeSlotDropdown(slotId){
  setTimeout(function(){
    var dd = document.getElementById(slotId + '-dd');
    if(dd) dd.style.display = 'none';
  }, 300); // 300ms gives time for onmousedown/ontouchend to fire first
}

function _selectSlotItem(e, slotId, id, label, cat){
  e.preventDefault();
  var inp  = document.getElementById(slotId + '-inp');
  var dd   = document.getElementById(slotId + '-dd');
  if(inp) inp.value = label;
  if(dd)  dd.style.display = 'none';
  var slot = inp ? inp.closest('.menu-slot') : null;
  if(slot){
    slot.dataset.value = id;
    slot.dataset.type  = cat || 'soup';

    // Remove old salad-price-row if exists
    var existingPriceRow = slot.querySelector('.salad-price-row');
    if(existingPriceRow) existingPriceRow.remove();

    // Find item and update price fields in the new unified price row
    var item = ALL_SOUPS.find(function(s){ return s.id === id; });
    var sz = _defaultSizesForItem(item || {cat: cat});
    var slotId = slot.querySelector('[id$="-inp"]') ? slot.querySelector('[id$="-inp"]').id.replace('-inp','') : null;

    if(slotId){
      var priceRow  = document.getElementById(slotId + '-prices');
      var lbl1El    = document.getElementById(slotId + '-lbl1');
      var lbl2El    = document.getElementById(slotId + '-lbl2');
      var p1El      = document.getElementById(slotId + '-p1');
      var p2El      = document.getElementById(slotId + '-p2');
      var p2wrap    = document.getElementById(slotId + '-p2wrap');

      if(priceRow){
        var s1 = sz[0] || {l:'Pint',  p:8};
        var s2 = sz[1] || null;
        if(lbl1El) lbl1El.value = s1.l;
        if(p1El)   p1El.placeholder   = s1.p;
        if(p1El)   p1El.value         = '';
        if(lbl2El) lbl2El.value = s2 ? s2.l : '';
        if(p2El)   p2El.placeholder   = s2 ? s2.p : '';
        if(p2El)   p2El.value         = '';
        if(p2wrap) p2wrap.style.display = s2 ? 'flex' : 'none';
        var addBtn = document.getElementById(slotId + '-addsz');
        if(addBtn) addBtn.style.display = s2 ? 'none' : 'inline-block';
        priceRow.style.display = 'flex';
      }
    }
  }
  _saveMenuSelections();
}

// Lets the admin add or remove a second size for ANY item, any week —
// independent of what the catalog's default sizing is.
function _toggleSlotSize(slotId, show){
  var p2wrap = document.getElementById(slotId + '-p2wrap');
  var addBtn = document.getElementById(slotId + '-addsz');
  if(!p2wrap) return;
  if(show){
    p2wrap.style.display = 'flex';
    if(addBtn) addBtn.style.display = 'none';
    var lbl2 = document.getElementById(slotId + '-lbl2');
    if(lbl2 && !lbl2.value.trim()) lbl2.value = 'Quart';
  } else {
    p2wrap.style.display = 'none';
    if(addBtn) addBtn.style.display = 'inline-block';
    var lbl2b = document.getElementById(slotId + '-lbl2');
    var p2b   = document.getElementById(slotId + '-p2');
    if(lbl2b) lbl2b.value = '';
    if(p2b)   p2b.value = '';
  }
  _saveMenuSelections();
}

function _addSaladSize(btn){
  var row = btn.closest('.salad-price-row');
  if(!row) return;
  var count = row.querySelectorAll('input[type="number"]').length;
  var newDiv = document.createElement('div');
  newDiv.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:12px;margin-top:4px';
  newDiv.innerHTML = '<span style="color:var(--t3)">Size:</span>'
    +'<input type="text" class="sz-label-'+count+'" placeholder="Label" '
    +'style="width:80px;padding:4px;border-radius:6px;border:1.5px solid var(--bd);font-size:12px" '
    +'onchange="_saveMenuSelections()">'
    +'<span style="color:var(--t3)">$</span>'
    +'<input type="number" class="sz-price-'+count+'" value="15" min="1" max="99" '
    +'style="width:50px;padding:4px;border-radius:6px;border:1.5px solid var(--bd);font-size:12px;text-align:center" '
    +'onchange="_saveMenuSelections()">';
  btn.before(newDiv);
  _saveMenuSelections();
}

function _saveMenuSelections(){
  var items = [];
  var container = $('menu-all-slots');
  var slots = container
    ? container.querySelectorAll('.menu-slot')
    : document.querySelectorAll('#menu-soup-slots .menu-slot, #menu-salad-slots .menu-slot, #menu-bakery-slots .menu-slot, #menu-other-slots .menu-slot');

  slots.forEach(function(s){
    var id   = s.dataset.value || '';
    var inp  = s.querySelector('input');
    var text = inp ? inp.value.trim() : '';
    var item = null;

    if(id){
      item = ALL_SOUPS.find(function(x){ return x.id === id; });
    }
    // Fallback: match by the text shown in the input (strips emoji prefix)
    if(!item && text){
      var cleanText = text.replace(/^[^\w]+/, '').trim(); // strip leading emoji
      item = ALL_SOUPS.find(function(x){ return x.n.toLowerCase() === cleanText.toLowerCase(); })
          || ALL_SOUPS.find(function(x){ return text.toLowerCase().includes(x.n.toLowerCase()); });
      if(item){
        s.dataset.value = item.id; // fix the dataset so it's correct going forward
        s.dataset.type  = item.cat;
      }
    }

    if(item){
      // For salads: read custom prices from UI if present
      var pushItem = { id: item.id, n: item.n, cat: item.cat, sz: item.sz ? item.sz.slice() : [] };
      // Read this week's sizing from the UI — always reflects what's
      // currently shown (label text + whether 2nd size is toggled on),
      // not just when a price override was typed.
      var slotInpId = s.querySelector('[id$="-inp"]') ? s.querySelector('[id$="-inp"]').id : null;
      if(slotInpId){
        var slotId   = slotInpId.replace('-inp','');
        var p1El     = document.getElementById(slotId + '-p1');
        var p2El     = document.getElementById(slotId + '-p2');
        var lbl1El   = document.getElementById(slotId + '-lbl1');
        var lbl2El   = document.getElementById(slotId + '-lbl2');
        var p2wrapEl = document.getElementById(slotId + '-p2wrap');
        var defSz    = _defaultSizesForItem(item);
        var p1Val    = p1El && p1El.value ? parseFloat(p1El.value) : null;
        var p2Val    = p2El && p2El.value ? parseFloat(p2El.value) : null;
        var lbl1     = (lbl1El && lbl1El.value.trim()) || (defSz[0] ? defSz[0].l : 'Pint');
        var lbl2     = (lbl2El && lbl2El.value.trim()) || (defSz[1] ? defSz[1].l : 'Quart');
        var def1     = defSz[0] ? defSz[0].p : 8;
        var def2     = defSz[1] ? defSz[1].p : 15;
        var secondSizeOn = p2wrapEl && p2wrapEl.style.display !== 'none';

        var customSz = [{ l: lbl1, p: p1Val || def1 }];
        if(secondSizeOn) customSz.push({ l: lbl2, p: p2Val || def2 });
        pushItem.sz = customSz;
      } else {
        // Legacy: read from old salad-price-row
        var priceRow = s.querySelector('.salad-price-row');
        if(priceRow && item && item.cat === 'salad'){
          var customSz = [];
          var priceInputs = priceRow.querySelectorAll('input[type="number"]');
          priceInputs.forEach(function(pi, idx){
            var label = priceRow.querySelector('.sz-label-'+idx);
            var lVal  = label ? label.value.trim() : (item.sz && item.sz[idx] ? item.sz[idx].l : 'Single');
            var price = parseInt(pi.value) || 15;
            if(lVal) customSz.push({l: lVal, p: price});
          });
          if(customSz.length) pushItem.sz = customSz;
        }
      }
      items.push(pushItem);
    } else if(id || text){
      // Unknown item — save what we have
      items.push({ id: id, n: text, cat: s.dataset.type || 'soup' });
    }
  });

  var soups  = items.filter(function(i){ return i.cat === 'soup'; });
  var salads = items.filter(function(i){ return i.cat === 'salad'; });
  var bakery = items.filter(function(i){ return i.cat === 'bakery'; });
  var other  = items.filter(function(i){ return i.cat === 'other'; });

  _menuSelections = { items: items, soups: soups, salads: salads, bakery: bakery, other: other };
  try{ localStorage.setItem('menu_builder', JSON.stringify(_menuSelections)); }catch(e){}
  console.log('Menu selections saved:', JSON.stringify(items));
}

function clearMenuBuilder(){
  if(!confirm('Clear all menu selections and start fresh?')) return;
  try{ localStorage.removeItem('menu_builder'); }catch(e){}
  _menuSelections = { items: [], soups: [], salads: [], bakery: [], other: [] };
  var container = $('menu-all-slots');
  if(container) container.innerHTML = '';
  _addSlotHTML('any', '');
  toast('Menu cleared — add your items and save');
}

function addMenuSlot(type){
  _addSlotHTML(type, '');
}

function _removeSlot(btn){
  btn.closest('.menu-slot').remove();
  _saveMenuSelections();
}

function saveMenuToSheet(){
  _saveMenuSelections();

  function resolveItems(arr){
    return arr.map(function(val){
      var id   = typeof val === 'object' ? val.id : val;
      var name = typeof val === 'object' ? val.n  : '';
      var item = ALL_SOUPS.find(function(s){ return s.id === id; })
              || ALL_SOUPS.find(function(s){ return s.n.toLowerCase() === (name||'').toLowerCase(); });
      if(!item) return null;
      // Preserve this week's sizing override (built in _saveMenuSelections)
      // instead of falling back to the catalog default — otherwise every
      // price/size edit made in the weekly panel above gets silently lost.
      var overrideSz = (typeof val === 'object' && val.sz && val.sz.length) ? val.sz : null;
      return overrideSz ? Object.assign({}, item, {sz: overrideSz}) : item;
    }).filter(Boolean);
  }

  // Resolve all items from unified or legacy selections
  var allItems = resolveItems(_menuSelections.items && _menuSelections.items.length
    ? _menuSelections.items
    : [].concat(_menuSelections.soups||[], _menuSelections.salads||[], _menuSelections.bakery||[], _menuSelections.other||[]));

  if(!allItems.length){ toast('Please add at least one item'); return; }
  var status = $('menu-save-status');
  if(status) status.textContent = 'Saving to Sheet...';
  console.log('Saving menu items:', allItems.map(function(s){return s.n+'('+s.cat+')';}));
  var menuData = {
    type:  'save_menu',
    items: allItems.map(function(s){ return {id:s.id, n:s.n, em:s.em, cat:s.cat, sz:s.sz||[]}; }),
    soups:  allItems.filter(function(s){return s.cat==='soup';}).map(function(s){return {id:s.id,n:s.n,em:s.em,cat:s.cat,sz:s.sz||[]};}),
    salads: allItems.filter(function(s){return s.cat==='salad';}).map(function(s){return {id:s.id,n:s.n,em:s.em,cat:s.cat,sz:s.sz||[]};}),
    bakery: allItems.filter(function(s){return s.cat==='bakery';}).map(function(s){return {id:s.id,n:s.n,em:s.em,cat:s.cat,sz:s.sz||[]};}),
    other:  allItems.filter(function(s){return s.cat==='other';}).map(function(s){return {id:s.id,n:s.n,em:s.em,cat:s.cat,sz:s.sz||[]};})
  };
  fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify(menuData),
    headers: { 'Content-Type': 'text/plain' }
  })
  .then(function(r){ return r.json(); })
  .then(function(d){
    if(d.success){
      if(status) status.textContent = 'Menu saved! ' + allItems.length + ' items.';
      MENU_ITEMS = allItems.map(function(s, i){
        var sizes = s.cat==='salad' ? [{l:'Salad',o:'reg',p:15}]
                  : s.cat==='bakery' ? [{l:'Each',o:'',p:s.sz&&s.sz[0]?s.sz[0].p:5}]
                  : s.sz || [{l:'Pint',o:'16oz',p:8},{l:'Quart',o:'32oz',p:15}];
        return {id:'m'+(i+1), cat:s.cat, em:s.em, n:s.n, desc:s.desc||'',
          tags:s.tags||[], soldout:false, al:s.al||[], soupId:s.id, sz:sizes};
      });
      buildMenu();
      toast('Menu saved to Sheet!');
    } else {
      if(status) status.textContent = (d.error||'Save failed');
      toast(d.error||'Save failed');
    }
  })
  .catch(function(err){
    if(status) status.textContent = err.message;
    toast(err.message);
  });
}

// S-025 (v262): Cook & pack. Built on the phone from this week's orders (get_dashboard
// already sends every item with its size and quantity), so Lia sees how much of each
// dish to make, the gift boxes and the gift cards to write, without opening the Sheet.
// It replaced a list of dishes with revenue and ↔ / ✕ buttons that only showed a toast.
// Gift box contents are already in their own item columns, so they are counted once.
function cookListData(orders){
  var dishes = {}, boxes = [], cards = [], notes = [], n = 0;
  (orders || []).forEach(function(o){
    if(!o || !o.email) return;
    n++;
    (o.items || []).forEach(function(i){
      if(!i || !i.name || i.name === 'Gift box (bread & packing)') return;
      var q = parseFloat(i.qty) || 0; if(q <= 0) return;
      var d = dishes[i.name] || (dishes[i.name] = { n: i.name, sizes: {}, qt: 0, measured: true });
      var sz = (i.size || '').trim().toLowerCase() || 'each';
      d.sizes[sz] = (d.sizes[sz] || 0) + q;
      if(sz === 'pint') d.qt += q / 2;
      else if(sz === 'quart') d.qt += q;
      else d.measured = false;
    });
    var note = (o.note || o.notes || '').toString(), m;
    var boxRe = /GIFT BOX(?: x(\d+))?: (.+?) \+ bread/g;
    while((m = boxRe.exec(note))) boxes.push({ who: o.n || o.name || '', qty: parseInt(m[1]) || 1, contents: m[2] });
    // "GIFT for Cy Friend ((248) 555-0101) — card: "…" — from Ben" (the phone is optional).
    var card = note.match(/GIFT for (.+?)(?: \(.*\))? — card: "([^"]*)"/);
    if(card) cards.push({ to: card[1].trim(), from: o.n || o.name || '', msg: card[2] });
    // The comment is "GIFT BOX: … | [Gift box extra …] | GIFT for … | customer's note".
    var plain = note.split('|').map(function(p){
      return p.replace(/\[[^\]]*\]/g, '').trim();
    }).filter(function(p){ return p && !/^GIFT BOX/.test(p) && !/^GIFT for /.test(p); }).join(' · ');
    if(plain) notes.push({ who: o.n || o.name || '', text: plain });
  });
  var list = Object.keys(dishes).map(function(k){ return dishes[k]; })
    .sort(function(a, b){ return (b.qt - a.qt) || a.n.localeCompare(b.n); });
  return { orders: n, dishes: list, boxes: boxes, cards: cards, notes: notes };
}

function fmtQty(x){ return (Math.round(x * 100) / 100).toString(); }

function textsLocalKey(week){ return 'texts_sent_' + week; }

function textsLocalSent(week){ try{ return JSON.parse(localStorage.getItem(textsLocalKey(week)) || '{}') || {}; }catch(e){ return {}; } }

function textsDay(){ return new Date().getDay() === 5 && orderWindow().state === 'open'; }

function buildTextsCard(preview){
  var el = $('texts-card'); if(!el) return;
  if(BACKEND_GS < 96){ el.style.display = 'none'; if(preview) toast('Friday texts switch on once the backend update (gs96) is live'); return; }
  if(!(preview || textsDay())){ el.style.display = 'none'; return; }
  el.style.display = '';
  el.innerHTML = '<h3>📱 Friday texts</h3><div style="font-size:12px;color:var(--t3)">Loading…</div>';
  fetch(APPS_SCRIPT_URL + '?type=get_text_reminders')
    .then(function(r){ return r.json(); })
    .catch(function(){ return null; })
    .then(function(d){
      if(!d || !d.success){ el.innerHTML = '<h3>📱 Friday texts</h3><div style="font-size:12px;color:var(--t3)">Couldn\'t load the list. Try again in a minute.</div>'; return; }
      var local = textsLocalSent(d.week);
      (d.people || []).forEach(function(p){ if(local[p.key]) p.sent = true; });
      TEXTS = { week: d.week, people: d.people || [], preview: !!preview && !textsDay() };
      renderTextsCard();
    });
}

function renderTextsCard(){
  var el = $('texts-card'); if(!el || !TEXTS) return;
  var ppl = TEXTS.people, done = ppl.filter(function(p){ return p.sent; }).length, next = ppl.filter(function(p){ return !p.sent; })[0];
  var h = '<h3 style="margin-bottom:4px">📱 Friday texts</h3>';
  if(TEXTS.preview) h += '<div style="background:#fff8e1;border-radius:8px;padding:7px 10px;font-size:12px;color:var(--t2);margin-bottom:8px">Preview. On Friday this list is live until 7 PM.</div>';
  if(!ppl.length){
    el.innerHTML = h + '<p style="font-size:13px;color:var(--t2);margin:0">Nobody to text: everyone recent has ordered (or asked not to be texted).</p>';
    return;
  }
  h += '<p style="font-size:12px;color:var(--t3);margin:0 0 10px;line-height:1.5">Tap the green button, tap <strong>Send</strong> in Messages, then come back. It moves to the next person by itself.</p>'
    +  '<div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;color:var(--t2);margin-bottom:4px"><span id="texts-progress">' + done + ' of ' + ppl.length + ' sent</span></div>'
    +  '<div style="height:6px;background:#eee;border-radius:3px;overflow:hidden;margin-bottom:12px"><div style="height:100%;width:' + Math.round(done / ppl.length * 100) + '%;background:var(--f)"></div></div>';
  if(next){
    h += TEXTS.preview
      ? '<div class="bp" id="text-next" style="display:block;text-align:center;opacity:.6">Text next: ' + esc(next.name) + '</div>'
      : '<a class="bp" id="text-next" href="' + esc(rtSmsUrl(next.phone, next.message)) + '" onclick="textSent(\'' + next.key + '\')" style="display:block;box-sizing:border-box;text-align:center;text-decoration:none">💬 Text next: ' + esc(next.name) + '</a>';
    h += '<div id="text-preview" style="white-space:pre-wrap;background:#f9f5f0;border-radius:10px;padding:10px 12px;font-size:12px;color:var(--t2);line-height:1.5;margin:10px 0 12px">' + esc(next.message) + '</div>';
  } else {
    h += '<div id="texts-done" style="text-align:center;font-size:14px;font-weight:700;color:var(--f);margin:6px 0 12px">All ' + ppl.length + ' sent. Thank you!</div>';
  }
  h += '<div style="border-top:1px solid #f0f0f0">' + ppl.map(function(p){
    return '<div class="text-row" style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid #f0f0f0;font-size:13px">'
      + '<div style="flex:1;min-width:0"><div style="font-weight:700;color:var(--f)">' + esc(p.name) + '</div><div style="font-size:11px;color:var(--t3)">' + esc(p.phone) + '</div></div>'
      + (p.sent ? '<span style="font-size:12px;font-weight:700;color:var(--f)">Sent ✓</span>'
         : (TEXTS.preview ? '' : '<a href="' + esc(rtSmsUrl(p.phone, p.message)) + '" onclick="textSent(\'' + p.key + '\')" style="font-size:12px;font-weight:700;color:var(--f);text-decoration:none;border:1.5px solid var(--f);border-radius:8px;padding:4px 10px">Text</a>'))
      + (TEXTS.preview ? '' : '<button class="text-stop" onclick="textStop(\'' + p.key + '\')" style="background:transparent;border:none;color:var(--t3);font-size:11px;cursor:pointer;padding:4px">Stop</button>')
      + '</div>';
  }).join('') + '</div>'
  + '<p style="font-size:11px;color:var(--t3);margin:8px 0 0;line-height:1.5">Someone replied STOP? Tap Stop next to their name and they won\'t be on this list again.</p>';
  el.innerHTML = h;
}

function textsPerson(key){ return TEXTS ? TEXTS.people.filter(function(p){ return p.key === key; })[0] : null; }

// The link opens Messages; this records it and, a moment later, moves the button to the next name.
function textSent(key){
  var p = textsPerson(key); if(!p || TEXTS.preview) return;
  p.sent = true;
  try{ var l = textsLocalSent(TEXTS.week); l[key] = 1; localStorage.setItem(textsLocalKey(TEXTS.week), JSON.stringify(l)); }catch(e){}
  fetch(APPS_SCRIPT_URL, { method:'POST', keepalive:true, headers:{ 'Content-Type':'text/plain' },
    body: JSON.stringify({ type:'text_reminder_mark', phone: p.phone, name: p.name, action:'sent' }) }).catch(function(){});
  setTimeout(renderTextsCard, 400);
}

function textStop(key){
  var p = textsPerson(key); if(!p) return;
  if(!confirm('Stop texting ' + p.name + '?\n\nThey won\'t be on this list again. (Their emails don\'t change.)')) return;
  fetch(APPS_SCRIPT_URL, { method:'POST', headers:{ 'Content-Type':'text/plain' },
    body: JSON.stringify({ type:'text_reminder_mark', phone: p.phone, name: p.name, action:'stop' }) })
    .then(function(r){ return r.json(); })
    .then(function(d){
      if(!d || !d.success){ toast('Couldn\'t save that. Try again.'); return; }
      TEXTS.people = TEXTS.people.filter(function(x){ return x.key !== key; });
      renderTextsCard(); toast(p.name + ' won\'t be texted again');
    })
    .catch(function(){ toast('Couldn\'t save that. Try again.'); });
}

function buildLinkStats(){
  var el = $('link-stats'); if(!el) return;
  if(BACKEND_GS < 97){ el.style.display = 'none'; return; }
  el.style.display = '';
  if(!LINK_STATS) el.innerHTML = '<h3 style="margin:0 0 4px">📈 How the posts are doing</h3><div style="font-size:12px;color:var(--t3)">Loading…</div>';
  fetch(APPS_SCRIPT_URL + '?type=get_link_stats')
    .then(function(r){ return r.json(); })
    .catch(function(){ return null; })
    .then(function(d){
      if(!d || !d.success){ if(!LINK_STATS) el.innerHTML = '<h3 style="margin:0 0 4px">📈 How the posts are doing</h3><div style="font-size:12px;color:var(--t3)">Couldn\'t load the numbers. Try again in a minute.</div>'; return; }
      LINK_STATS = d; renderLinkStats();
    });
}

function setLinkStatsPeriod(p){ LINK_STATS_P = p; renderLinkStats(); }

function renderLinkStats(){
  var el = $('link-stats'), d = LINK_STATS; if(!el || !d) return;
  var P = d.periods[LINK_STATS_P] || { visitors:0, orders:0, links:[], people:[] };
  var tab = function(k, label){ var on = LINK_STATS_P === k;
    return '<button class="ls-tab" onclick="setLinkStatsPeriod(\'' + k + '\')" style="flex:1;padding:7px 4px;border-radius:8px;border:1.5px solid var(--f);background:' + (on ? 'var(--f)' : '#fff') + ';color:' + (on ? '#fff' : 'var(--f)') + ';font-size:12px;font-weight:700;cursor:pointer">' + label + '</button>'; };
  var h = '<h3 style="margin:0 0 8px">📈 How the posts are doing</h3>'
    + '<div style="display:flex;gap:6px;margin-bottom:12px">' + tab('week', 'This week') + tab('last', 'Last week') + tab('all', 'All time') + '</div>'
    + '<div style="font-size:11px;color:var(--t3);margin:-6px 0 10px">' + (LINK_STATS_P === 'week' ? 'Since Monday, ' + esc(d.weekOf) : LINK_STATS_P === 'last' ? 'Week of ' + esc(d.lastWeekOf) : 'Since tracking began') + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">'
    +   '<div style="background:#f9f5f0;border-radius:10px;padding:10px;text-align:center"><div id="ls-visitors" style="font-size:22px;font-weight:900;color:var(--f)">' + P.visitors + '</div><div style="font-size:11px;color:var(--t2);font-weight:700">people opened a link</div></div>'
    +   '<div style="background:#f0faf0;border-radius:10px;padding:10px;text-align:center"><div id="ls-orders" style="font-size:22px;font-weight:900;color:var(--f)">' + P.orders + '</div><div style="font-size:11px;color:var(--t2);font-weight:700">orders through a link</div></div>'
    + '</div>';
  if((P.people || []).length){
    h += '<div style="font-size:12px;font-weight:800;color:var(--t2);margin-bottom:4px">Facebook group posts</div>'
      + P.people.map(function(p){
          return '<div class="ls-person" style="font-size:13px;padding:4px 0">' + esc(p.name) + ': <strong>' + p.visitors + '</strong> opened, <strong>' + p.orders + '</strong> order' + (p.orders === 1 ? '' : 's')
            + (p.reach ? ' <span style="color:var(--t3);font-size:11px">· posts reach ' + (Math.round(p.reach / 100) / 10) + 'K members</span>' : '') + '</div>';
        }).join('');
  }
  if(P.links.length){
    h += '<div style="font-size:12px;font-weight:800;color:var(--t2);margin:10px 0 4px">By link</div>'
      + '<div style="display:flex;font-size:10px;color:var(--t3);font-weight:700;text-transform:uppercase;letter-spacing:.4px;padding:0 0 4px"><span style="flex:1">Link</span><span style="width:52px;text-align:right">Opened</span><span style="width:52px;text-align:right">Orders</span></div>'
      + P.links.map(function(l){
          return '<div class="ls-row" style="display:flex;align-items:center;font-size:13px;padding:6px 0;border-top:1px solid #f0f0f0">'
            + '<span style="flex:1;min-width:0;padding-right:6px">' + esc(l.label) + '</span>'
            + '<span style="width:52px;text-align:right">' + l.visitors + '</span>'
            + '<span style="width:52px;text-align:right;font-weight:700;color:' + (l.orders ? 'var(--f)' : 'var(--t3)') + '">' + l.orders + '</span></div>';
        }).join('');
  } else {
    h += '<p style="font-size:13px;color:var(--t2);margin:6px 0">No one has come through a link yet ' + (LINK_STATS_P === 'week' ? 'this week' : LINK_STATS_P === 'last' ? 'last week' : '') + '.</p>';
  }
  var t = d.test;
  if(t && (t.early.weeks || t.late.weeks)){
    var avg = function(a){ return a.weeks ? Math.round(a.orders / a.weeks * 10) / 10 : 0; };
    h += '<div style="background:#f9f5f0;border-radius:10px;padding:9px 11px;margin-top:12px;font-size:12px;color:var(--t2);line-height:1.5">'
      + '<strong>Big groups: Tuesday or Friday?</strong> Tuesday weeks: ' + avg(t.early) + ' orders a week (' + t.early.weeks + ' week' + (t.early.weeks === 1 ? '' : 's') + '). '
      + 'Friday weeks: ' + avg(t.late) + ' (' + t.late.weeks + ' week' + (t.late.weeks === 1 ? '' : 's') + '). Give it about 4 weeks of each.</div>';
  }
  h += '<p style="font-size:11px;color:var(--t3);margin:10px 0 0;line-height:1.5">"Opened" counts each phone once a day. An order counts for the last link that phone came through in the 2 weeks before. Someone who saw a post but opened the app another way isn\'t counted.</p>';
  el.innerHTML = h;
}

// v263 (gs85): what each delivery kept after groceries and driving. Lia sends her receipts by
// replying to the "Receipts for your … delivery" email; the route logs the miles. The server
// works the numbers out hourly; this only shows them. Hidden until the backend sends `costs`.
function buildCostsCard(weeks, periods){
  var el = $('costs-card'); if(!el) return;
  var $m = function(n){ var v = Math.round((Number(n)||0) * 100) / 100; return (v < 0 ? '-$' : '$') + Math.abs(v).toFixed(2); };
  var h = '<h3>💵 What you kept</h3>';
  if(!weeks.length){
    h += '<p style="font-size:13px;color:var(--t2);margin:0;line-height:1.5">After Monday\'s deliveries you\'ll get an email, <strong>"Receipts for your … delivery"</strong>. '
      +  'Reply with a photo of each grocery receipt and the total. Your profit for the week shows up here.</p>';
  } else {
    var th = 'style="padding:5px 4px;text-align:right;font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.5px"';
    var td = 'style="padding:6px 4px;text-align:right;border-top:1px solid #f0f0f0"';
    h += '<table style="width:100%;border-collapse:collapse;font-size:13px"><tr><th ' + th.replace('right','left') + '>Delivery</th><th ' + th + '>Sales</th><th ' + th + '>Costs</th><th ' + th + '>Driving</th><th ' + th + '>Kept</th></tr>';
    // gs86: costs come in four kinds (the four lines of the weekly email).
    var KIND_SHORT = { Groceries: 'food', Packaging: 'packing', 'Gift box': 'gift box', Other: 'other' };
    weeks.forEach(function(w){
      var spent = w.spent !== undefined ? w.spent : w.groceries;
      var parts = Object.keys(w.byKind || {}).filter(function(k){ return w.byKind[k] && KIND_SHORT[k]; })
        .map(function(k){ return KIND_SHORT[k] + ' ' + $m(w.byKind[k]).replace('.00', ''); });
      var groc = w.answered
        ? '−' + $m(spent) + (parts.length > 1 ? '<br><span style="font-size:10px;color:var(--t3)">' + esc(parts.join(' · ')) + '</span>' : '')
        : '<span style="color:#b45309;font-size:11px">' + (w.photoNoTotal ? 'need total' : 'waiting') + '</span>';
      var drive = w.miles ? '−' + $m(w.mileCost) + '<br><span style="font-size:10px;color:var(--t3)">' + esc(w.miles) + ' mi</span>' : '<span style="color:var(--t3)">—</span>';
      var kept = w.kept === null ? '<span style="color:var(--t3)">—</span>' : '<strong style="color:' + (w.kept >= 0 ? 'var(--f)' : 'var(--cl)') + '">' + $m(w.kept) + '</strong>';
      h += '<tr><td ' + td.replace('right','left') + '>' + esc(w.label) + '<br><span style="font-size:10px;color:var(--t3)">' + (w.orders||0) + ' orders</span></td>'
        +  '<td ' + td + '>' + $m(w.sales) + '</td><td ' + td + '>' + groc + '</td><td ' + td + '>' + drive + '</td><td ' + td + '>' + kept + '</td></tr>';
    });
    // gs88: this month and this year, from the same numbers.
    [periods && periods.month, periods && periods.year].forEach(function(p, i){
      if(!p || !p.deliveries) return;
      var tdp = td.replace('border-top:1px solid #f0f0f0', 'border-top:' + (i ? '1px' : '2px') + ' solid var(--f);background:#f7faf5');
      h += '<tr><td ' + tdp.replace('right','left') + '><strong>' + esc(p.name) + '</strong><br><span style="font-size:10px;color:var(--t3)">'
        +  p.deliveries + ' deliver' + (p.deliveries === 1 ? 'y' : 'ies') + (p.missing && p.missing.length ? ', ' + p.missing.length + ' waiting' : '') + '</span></td>'
        +  '<td ' + tdp + '>' + $m(p.sales) + '</td><td ' + tdp + '>−' + $m(p.spent) + '</td><td ' + tdp + '>' + (p.miles ? '−' + $m(p.mileCost) + '<br><span style="font-size:10px;color:var(--t3)">' + esc(p.miles) + ' mi</span>' : '—') + '</td>'
        +  '<td ' + tdp + '><strong>' + (p.withCosts ? $m(p.kept) : '—') + '</strong></td></tr>';
    });
    h += '</table>';
    var waiting = weeks.filter(function(w){ return !w.answered && w.orders; })[0];
    h += '<p style="font-size:12px;color:var(--t3);margin:10px 0 0;line-height:1.5">'
      + (waiting ? '🛒 To fill in <strong>' + esc(waiting.label) + '</strong>: reply to the "Receipts for your ' + esc(waiting.label) + ' delivery" email with your receipt photos and what you spent on groceries, containers, gift boxes and anything else (or "none"). '
                 : '')
      + 'Delivery driving is logged by itself when you use the 🚗 Route tab; add trips to the store on the email\'s "Shopping miles" line. Miles count at the IRS rate, for taxes. '
      + 'A summary of each month comes by email early the next month, and a year-end summary for your taxes in January, after a reminder to add anything not logged yet.</p>';
  }
  el.innerHTML = h;
  el.style.display = '';
}

function buildWkMenu(){
  var el = $('wkml'); if(!el) return;
  var c = cookListData(ORDERS);
  var h = '<div class="ccrd"><h3>🍳 Cook &amp; pack</h3>'
    + '<p style="font-size:12px;color:var(--t3);margin:0 0 10px">Updates as orders come in · ' + c.orders + ' order' + (c.orders === 1 ? '' : 's') + ' so far · orders close Friday 7 PM</p>';
  if(!c.dishes.length){
    el.innerHTML = h + '<div style="font-size:13px;color:var(--t3)">No orders yet this week.</div></div>';
    return;
  }
  h += c.dishes.map(function(d){
    var parts = Object.keys(d.sizes).map(function(s){
      var q = d.sizes[s];
      return s === 'each' ? fmtQty(q) : fmtQty(q) + ' ' + esc(s) + (q !== 1 && (s === 'pint' || s === 'quart') ? 's' : '');
    });
    var tot = d.measured && d.qt ? ' <span style="color:var(--f);font-weight:800">= ' + fmtQty(d.qt) + ' qt (' + fmtQty(d.qt / 4) + ' gal)</span>' : '';
    return '<div style="display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid #f0f0f0;font-size:13px">'
      + '<strong style="min-width:0">' + esc(d.n) + '</strong><span style="text-align:right;color:var(--t2)">' + parts.join(' · ') + tot + '</span></div>';
  }).join('');
  if(c.boxes.length){
    var nb = c.boxes.reduce(function(a, b){ return a + b.qty; }, 0);
    h += '<div style="margin-top:12px;font-size:12px;font-weight:800;color:var(--t3);letter-spacing:.5px">🎁 GIFT BOXES (' + nb + ')</div>'
      + c.boxes.map(function(b){ return '<div style="font-size:13px;padding:3px 0">' + (b.qty > 1 ? b.qty + ' × ' : '') + esc(b.contents) + ' + bread <span style="color:var(--t3)">· ' + esc(b.who) + '</span></div>'; }).join('');
  }
  if(c.cards.length){
    h += '<div style="margin-top:12px;font-size:12px;font-weight:800;color:var(--t3);letter-spacing:.5px">✍️ GIFT CARDS TO WRITE (' + c.cards.length + ')</div>'
      + c.cards.map(function(x){ return '<div style="font-size:13px;padding:3px 0">To <strong>' + esc(x.to) + '</strong>: "' + esc(x.msg) + '" <span style="color:var(--t3)">· from ' + esc(x.from) + '</span></div>'; }).join('');
  }
  if(c.notes.length){
    h += '<div style="margin-top:12px;font-size:12px;font-weight:800;color:var(--t3);letter-spacing:.5px">📝 NOTES (' + c.notes.length + ')</div>'
      + c.notes.map(function(x){ return '<div style="font-size:13px;padding:3px 0"><strong>' + esc(x.who) + ':</strong> ' + esc(x.text) + '</div>'; }).join('');
  }
  el.innerHTML = h + '</div>';
}

// Global last-date lookup for soups (used by suggestions + intel display)
function _getLD(s){
  if(s && s.last_date) return s.last_date;
  if(s && s._as_date) return s._as_date;
  var name = (s && s.n || '').toLowerCase();
  // Search original SOUP_INTEL by fuzzy word match
  var words = name.split(/\s+/).filter(function(w){return w.length>3;});
  var orig = _SOUP_INTEL_ORIG.find(function(x){
    var xn = x.n.toLowerCase();
    return words.filter(function(w){return xn.indexOf(w)>=0;}).length >= Math.min(2,words.length||1);
  });
  if(orig && orig.last_date) return orig.last_date;
  // Derive from last_sort (numeric YYYYMMDD) if available on the item or its orig match
  var ls = (s && s.last_sort) || (orig && orig.last_sort) || 0;
  if(ls){
    var lss=ls.toString();
    if(lss.length===8){
      var _mo=['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return _mo[parseInt(lss.substring(4,6))]+'  '+parseInt(lss.substring(6,8))+', '+lss.substring(0,4);
    }
  }
  return '';
}

function buildSoupIntel(){
  var currentSort='avg';
  var currentCat='All';
  var currentSearch='';
  var sortAsc=false;  // false = descending (highest first)
  var retired={}; try{retired=JSON.parse(localStorage.getItem('retired_soups')||'{}');}catch(e){}

  // SOUP_INTEL is built from SALES, so an item that has never sold — a brand-new salad
  // Lia just created — is not in it, and searching for it found nothing even though it
  // existed. While searching, also offer catalog and this-week's-menu items that have no
  // sales row, so they can still be found and edited.
  function noSalesMatches(q){
    var seen={};
    SOUP_INTEL.forEach(function(s){ seen[(s.n||'').toLowerCase().trim()]=true; });
    var out=[];
    function add(it, useId){
      var nm=(it.n||'').trim(), key=nm.toLowerCase();
      if(!nm || seen[key] || key.indexOf(q)<0) return;
      seen[key]=true;
      var c=(it.cat||'soup').toString();
      out.push({n:nm, id:(useId && it.id) || nm, cat:c.charAt(0).toUpperCase()+c.slice(1).toLowerCase(),
                rev:0, weeks:0, avg:0, last:0, last_sort:0, _noSales:true});
    }
    // Catalog ids are stable; this week's menu ids are positional ('m1', 'm2'…), so
    // menu-only items are keyed by name — editItemModal cannot resolve 'm3'.
    (ALL_SOUPS||[]).forEach(function(it){ add(it, true); });
    (MENU_ITEMS||[]).forEach(function(it){ add(it, false); });
    return out;
  }

  function getSorted(){
    var q=currentSearch.toLowerCase().trim();
    var pool=q ? SOUP_INTEL.concat(noSalesMatches(q)) : SOUP_INTEL;
    var items=pool.filter(function(s){
      var matchesCat=(currentCat==='All'||s.cat===currentCat) && !retired[s.n];
      var matchesSearch=!q||s.n.toLowerCase().indexOf(q)>=0;
      return matchesCat && matchesSearch;
    });
    items.sort(function(a,b){
      var v=0;
      if(currentSort==='avg') v=b.avg-a.avg;
      else if(currentSort==='rev') v=b.rev-a.rev;
      else if(currentSort==='last_sort') v=b.last_sort-a.last_sort;
      return sortAsc?-v:v;
    });
    return items;
  }

  function render(){
    retired={}; try{retired=JSON.parse(localStorage.getItem('retired_soups')||'{}');}catch(e){}
    var items=getSorted();
    var mx=items.reduce(function(m,s){return Math.max(m,s.rev);},1);
    var html='';
    // (lookup now global)
    items.forEach(function(s,i){
      var barW=Math.round(s.rev/mx*100);
      var age=s.last_sort;
      var barColor=age>=20260300?'#16a34a':age>=20260100?'#2E6B30':age>=20251000?'var(--sg)':'#aaa';
      html+='<div class="si-row">';
      html+='<div class="si-rank'+(i<3&&!sortAsc&&currentSort==='avg'?' top':'')+'">'+(i+1)+'</div>';
      html+='<div class="si-inf">';
      // Clean name — strip description if concatenated (stop at common sentence starters)
      var displayName = s.n.replace(/\s+(this |the |a |an |with |served |has |and it |it |is )[a-z].*/i,'').trim();
      // Title case if all caps
      if(displayName === displayName.toUpperCase()){
        displayName = displayName.split(' ').map(function(w){ return w.length>0?w[0]+w.slice(1).toLowerCase():w; }).join(' ');
      }
      html+='<strong>'+displayName+'</strong>';
      html+= s._noSales
        ? '<span style="font-size:11px;color:var(--t3)">'+s.cat+' &middot; <strong style="color:var(--f)">New — no sales yet</strong></span>'
        : '<span style="font-size:11px;color:var(--t3)">'+s.cat+' &middot; '+s.weeks+' wk'+(s.weeks>1?'s':'')+' &middot; Last: <strong style="color:var(--f)">'+_getLD(s)+'</strong></span>';
      html+='<div class="si-bar-w"><div class="si-bar-f" style="width:'+barW+'%;background:'+barColor+'"></div></div>';
      html+='</div>';
      html+='<div class="si-rev">';
      html+='<strong>$'+Math.round(s.avg||0)+'/wk</strong>';
      html+='<span style="font-size:10px;color:var(--t3)">$'+s.rev.toLocaleString()+' total</span>';
      html+='<span style="font-size:10px;color:var(--t3)">Last: $'+s.last+'</span>';
      html+='<button data-nm="'+s.n.replace(/"/g,'&quot;')+'" onclick="retireSoup(this.dataset.nm)" style="margin-top:4px;font-size:9px;padding:2px 7px;background:#fee2e2;color:#991b1b;border:none;border-radius:5px;cursor:pointer">🗄 Retire</button>';
      html+='<button data-id="'+(s.id||s.n).replace(/"/g,'&quot;')+'" onclick="editItemModal(this.dataset.id)" style="margin-top:4px;margin-left:4px;font-size:9px;padding:2px 7px;background:#e0f2fe;color:#0369a1;border:none;border-radius:5px;cursor:pointer">✏️ Edit</button>';
      html+='</div></div>';
    });
    // Retired section
    var retiredNames=Object.keys(retired);
    if(retiredNames.length>0){
      html+='<div style="margin-top:16px;padding-top:12px;border-top:1px dashed var(--bd)">';
      html+='<div style="font-size:12px;color:var(--t3);font-weight:600;margin-bottom:8px">🗄 Retired ('+retiredNames.length+')</div>';
      retiredNames.forEach(function(nm){
        html+='<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;font-size:12px;color:var(--t3)">';
        html+='<span>'+nm+'</span>';
        html+='<button data-nm="'+nm.replace(/"/g,'&quot;')+'" onclick="unretireSoup(this.dataset.nm)" style="font-size:9px;padding:2px 7px;background:var(--sgl);color:var(--f);border:none;border-radius:5px;cursor:pointer">↩ Restore</button>';
        html+='</div>';
      });
      html+='</div>';
    }
    var sil=$('si-list'); if(sil) sil.innerHTML=html;
    updateCtrlActive();
  }

  function updateCtrlActive(){
    var ctrl=$('si-controls'); if(!ctrl) return;
    ctrl.querySelectorAll('[data-c]').forEach(function(b){b.classList.toggle('active',b.dataset.c===currentCat);});
    ctrl.querySelectorAll('[data-s]').forEach(function(b){b.classList.toggle('active',b.dataset.s===currentSort);});
    var sortBtn=$('si-sort-dir'); if(sortBtn) sortBtn.textContent=sortAsc?'↑ Asc':'↓ Desc';
  }

  var ctrl=$('si-controls');
  if(!ctrl){
    ctrl=document.createElement('div'); ctrl.id='si-controls'; ctrl.style='margin-bottom:12px';
    var siList=$('si-list');
    if(!siList||!siList.parentElement) return;
    siList.parentElement.insertBefore(ctrl,siList);
  }
  ctrl.innerHTML=
    '<div style="position:relative;margin-bottom:10px">'
    +'<input id="si-search" type="text" placeholder="🔍 Search soups & salads..." value="'+currentSearch+'"'
    +' oninput="siSearch(this.value)"'
    +' onfocus="this.style.borderColor=\'var(--sg)\'" onblur="this.style.borderColor=\'var(--bd)\'"'
    +' style="width:100%;padding:9px 36px 9px 12px;border:2px solid var(--bd);border-radius:10px;font-size:14px;font-family:\'DM Sans\',sans-serif;outline:none;box-sizing:border-box">'
    +'<button onclick="siSearch(\'\');document.getElementById(\'si-search\').value=\'\'" '
    +'id="si-search-clear" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;font-size:16px;color:var(--t3);cursor:pointer;display:'+(currentSearch?'block':'none')+'">&times;</button>'
    +'</div>'
    +'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">'
    +'<span style="font-size:11px;color:var(--t2);font-weight:600;align-self:center">Filter:</span>'
    +['All','Soup','Salad'].map(function(c){
      return '<button class="chip'+(c===currentCat?' active':'')+'" data-c="'+c+'" onclick="siSetCat(this)">'+c+'</button>';
    }).join('')+'</div>'
    +'<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">'
    +'<span style="font-size:11px;color:var(--t2);font-weight:600">Sort:</span>'
    +[['avg','$/Wk'],['rev','Total Rev'],['last_sort','Last On Menu']].map(function(p){
      return '<button class="chip'+(p[0]===currentSort?' active':'')+'" data-s="'+p[0]+'" onclick="siSetSort(this)" style="font-size:11px;padding:4px 10px">'+p[1]+'</button>';
    }).join('')
    +'<button id="si-sort-dir" onclick="siToggleDir()" class="chip" style="font-size:11px;padding:4px 10px">'+(sortAsc?'↑ Asc':'↓ Desc')+'</button>'
    +'</div>';

  window.siSetCat=function(b){currentCat=b.dataset.c;render();};
  window.siSetSort=function(b){currentSort=b.dataset.s;render();};
  window.siToggleDir=function(){sortAsc=!sortAsc;render();};
  window.siSearch=function(v){
    currentSearch=v;
    var clr=document.getElementById('si-search-clear');
    if(clr) clr.style.display=v?'block':'none';
    render();
  };
  window.retireSoup=function(nm){
    retired[nm]=true;
    try{localStorage.setItem('retired_soups',JSON.stringify(retired));}catch(e){}
    toast('🗄 '+nm+' retired');
    render();
    buildRepo(); // remove from recipes too
  };
  window.unretireSoup=function(nm){
    delete retired[nm];
    try{localStorage.setItem('retired_soups',JSON.stringify(retired));}catch(e){}
    toast('✅ '+nm+' restored');
    render();
    buildRepo();
  };
  render();
}

function sendRatingRequests(btn){
  btn.disabled = true;
  btn.textContent = '⏳ Sending…';
  fetch(APPS_SCRIPT_URL, {
    method:  'POST',
    body:    JSON.stringify({ type: 'send_rating_requests', manual: true }),
    headers: { 'Content-Type': 'text/plain' }
  })
  .then(function(r){ return r.text(); })
  .then(function(t){
    var d = null; try { d = JSON.parse(t); } catch(e) {}
    if(!d || d.success === false){ throw new Error((d && d.error) || 'unclear answer'); }
    btn.textContent = '✅ Done';
    btn.style.background = 'var(--sg)';
    var msg = d.sent == null ? '⭐ Catch-up requested'
      : '⭐ Asked ' + d.sent + (d.already ? ' · ' + d.already + ' already asked' : '') + (d.skipped ? ' · ' + d.skipped + ' held back (email limit)' : '');
    if(d.msg) msg = '⭐ ' + d.msg;
    toast(msg);
    setTimeout(function(){ btn.disabled = false; btn.textContent = '📤 Send Catch-up Requests'; btn.style.background = ''; }, 5000);
  })
  .catch(function(err){
    btn.disabled = false;
    btn.textContent = '📤 Send Catch-up Requests';
    toast('⚠️ Not sure it went through. Nobody is asked twice, so it is safe to try again.');
  });
}

function buildRatings(){
  // Every dish with real ratings, written review or not (the recipe list's made-up 5.0s are gone, S-020).
  const rated=ALL_SOUPS.filter(s=>s.rating>0).sort((a,b)=>b.rating-a.rating);
  $('ratings-list').innerHTML = rated.length
    ? rated.map(s=>`<div class="rat-row">
        <span style="font-size:20px">${s.em}</span>
        <div style="flex:1"><strong style="display:block;font-size:13px">${s.n}</strong><span style="font-size:11px;color:var(--t3)">${ratingCount(s)} rating${ratingCount(s)!==1?'s':''}</span></div>
        <div style="text-align:right"><div style="color:var(--am);font-size:14px">${stars(s.rating)}</div><div style="font-size:12px;color:var(--f);font-weight:700">${s.rating.toFixed(1)}</div></div>
      </div>`).join('')
    : '<p style="font-size:13px;color:var(--t3)">No ratings yet. They arrive as customers tap "Rate Your Order" in their invoice.</p>';
}

function buildCusts(){
  var retiredC={};
  try{retiredC=JSON.parse(localStorage.getItem('retired_customers')||'{}');}catch(e){}
  var currentSort='ltv';
  var sortAsc=false;
  var currentFilter='all';

  function getSorted(){
    var items=CUSTS.filter(function(c){
      if(retiredC[c.i+c.n]) return false;
      if(currentFilter==='vip') return c.vip;
      if(currentFilter==='risk') return c.risk;
      return true;
    });
    items.sort(function(a,b){
      var v=0;
      if(currentSort==='ltv')    v=b.ltv-a.ltv;
      else if(currentSort==='orders') v=b.cnt-a.cnt;
      else if(currentSort==='recent') v=a.days-b.days;
      else if(currentSort==='name')   v=a.n.localeCompare(b.n);
      return sortAsc?-v:v;
    });
    return items;
  }

  function render(){
    var retiredC={};
    try{retiredC=JSON.parse(localStorage.getItem('retired_customers')||'{}');}catch(e){}
    var items=getSorted();
    var retiredNames=Object.keys(retiredC);
    var instCount = items.filter(function(x){ return x.installed; }).length;
    var browserCount = items.length - instCount;
    var html='<div style="font-size:12px;color:var(--t3);margin-bottom:8px">'+items.length+' active customers'
      + ' · <span style="color:#3730a3;font-weight:600">📱 '+instCount+' installed</span>'
      + ' · <span>🌐 '+browserCount+' browser</span>'
      + (browserCount>0 ? ' · <a href="#" onclick="sendAppInvites(event)" style="color:var(--f);font-weight:600">Invite browser users to install →</a>' : '')
      + '</div>';
    html+=items.map(function(c){
      var riskTag=c.risk?'<span style="font-size:9px;color:var(--cl);font-weight:700"> ⚠️ '+c.days+'d ago</span>':'';
      var vipTag=c.vip?'⭐ ':'';
      // Installed home-screen app vs ordinary browser, from their most recent order
      var instTag = c.installed
        ? '<span style="font-size:9px;background:#e0e7ff;color:#3730a3;border-radius:4px;padding:1px 5px;font-weight:700;margin-left:4px" title="Has the app installed'+(c.platform?' ('+esc(c.platform)+')':'')+'">📱</span>'
        : '<span style="font-size:9px;background:#f3f4f6;color:#777;border-radius:4px;padding:1px 5px;font-weight:700;margin-left:4px" title="Orders from a browser'+(c.platform?' ('+esc(c.platform)+')':'')+'">🌐</span>';
      // S-024: names and addresses are typed by customers, so they are escaped and
      // passed to buttons through data- attributes, never built into onclick code.
      // S-026: "Send Offer" sends the real WELCOMEBACK email (it used to only say "sent").
      return '<div class="ccu '+(c.risk?'risk ':' ')+(c.vip?'vip':'')+'">'
        +'<div class="cav '+(c.vip?'vip':'')+'">'+esc(c.i)+'</div>'
        +'<div class="cinf"><strong>'+vipTag+esc(c.n)+'</strong>'+instTag+riskTag
        +'<span>📍 '+esc(c.addr)+'</span>'
        +(c.risk&&(c.email||c.phone)?'<div><button class="ofb" data-name="'+esc(c.n)+'" data-email="'+esc(c.email||'')+'" data-phone="'+esc(c.phone||'')+'" onclick="sendReact(this)">💌 Send Offer</button></div>':'')
        +'<button data-key="'+esc(c.i+c.n.replace(/[^a-z]/gi,''))
        +'" data-name="'+esc(c.n)+'" onclick="retireCustomer(this.dataset.key,this.dataset.name)"'
        +' style="font-size:9px;padding:2px 7px;background:#fee2e2;color:#991b1b;border:none;border-radius:5px;cursor:pointer;margin-top:4px">🗄 Retire</button>'
        +'</div>'
        +'<div class="cord"><strong>$'+c.ltv.toLocaleString()+'</strong>'
        +'<span>'+c.cnt+' orders</span>'
        +'<div style="font-size:10px;color:var(--t3)">'+c.last+'</div></div>'
        +'</div>';
    }).join('');
    if(retiredNames.length>0){
      html+='<div style="margin-top:16px;padding-top:12px;border-top:1px dashed var(--bd)">'
        +'<div style="font-size:12px;color:var(--t3);font-weight:600;margin-bottom:8px">🗄 Retired ('+retiredNames.length+')</div>';
      retiredNames.forEach(function(key){
        var nm=retiredC[key].name||key;
        html+='<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;font-size:12px;color:var(--t3)">'
          +'<span>'+esc(nm)+'</span>'
          +'<button data-k="'+esc(key)+'" onclick="unretireCustomer(this.dataset.k)" style="font-size:9px;padding:2px 7px;background:var(--sgl);color:var(--f);border:none;border-radius:5px;cursor:pointer">↩ Restore</button>'
          +'</div>';
      });
      html+='</div>';
    }
    var el=$('custl'); if(el) el.innerHTML=html;
    updateCustCtrl();
  }

  function updateCustCtrl(){
    var ctrl=$('cust-controls'); if(!ctrl) return;
    ctrl.querySelectorAll('[data-cs]').forEach(function(b){b.classList.toggle('active',b.dataset.cs===currentSort);});
    ctrl.querySelectorAll('[data-cf]').forEach(function(b){b.classList.toggle('active',b.dataset.cf===currentFilter);});
    var dirBtn=$('cust-sort-dir'); if(dirBtn) dirBtn.textContent=sortAsc?'↑ Asc':'↓ Desc';
  }

  // Build controls
  var ctrl=$('cust-controls');
  if(!ctrl){
    ctrl=document.createElement('div'); ctrl.id='cust-controls'; ctrl.style='margin-bottom:12px';
    var custl=$('custl'); if(custl&&custl.parentElement) custl.parentElement.insertBefore(ctrl,custl);
  }
  if(ctrl){
    ctrl.innerHTML=
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">'
      +'<span style="font-size:11px;font-weight:600;color:var(--t2);align-self:center">Filter:</span>'
      +[['all','All'],['vip','⭐ VIP'],['risk','⚠️ At Risk']].map(function(p){
        return '<button class="chip'+(p[0]===currentFilter?' active':'')+'" data-cf="'+p[0]+'" onclick="custSetFilter(this)" style="font-size:11px;padding:4px 10px">'+p[1]+'</button>';
      }).join('')+'</div>'
      +'<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">'
      +'<span style="font-size:11px;font-weight:600;color:var(--t2)">Sort:</span>'
      +[['ltv','LTV $'],['orders','Orders'],['recent','Recent'],['name','Name']].map(function(p){
        return '<button class="chip'+(p[0]===currentSort?' active':'')+'" data-cs="'+p[0]+'" onclick="custSetSort(this)" style="font-size:11px;padding:4px 10px">'+p[1]+'</button>';
      }).join('')
      +'<button id="cust-sort-dir" onclick="custToggleDir()" class="chip" style="font-size:11px;padding:4px 10px">'+(sortAsc?'↑ Asc':'↓ Desc')+'</button>'
      +'</div>';
  }

  window.custSetFilter=function(b){currentFilter=b.dataset.cf;render();};
  window.custSetSort=function(b){currentSort=b.dataset.cs;render();};
  window.custToggleDir=function(){sortAsc=!sortAsc;render();};
  render();
}

// Summarises how the customer base actually behaves — repeat rate, where people drop
// off, how much of the base is still active, and what the lapsed group is worth. This
// is the input for deciding between winning customers back and acquiring new ones.
// Default to the post-app-launch window: delivery fees, salads and saved profiles were
// all in place from May 2026, so that period is far more consistent than the full history.
// Win-back survey: one question to lapsed regulars, with the free-delivery offer made
// unconditionally so the answers aren't shaped by wanting the reward.
function sendSurvey(){
  fetch(APPS_SCRIPT_URL, {
    method:'POST', headers:{'Content-Type':'text/plain'},
    body: JSON.stringify({type:'send_survey', dryRun:true})
  })
  .then(function(r){ return r.json(); })
  .then(function(d){
    if(!d || !d.success){ toast('Could not check: '+((d&&d.error)||'unknown')); return; }
    if(d.sent === 0 && d.skipped > 0){
      alert('No room in today\'s email quota.\n\n'+d.skipped+' people are waiting. Try a day without a '
        + 'scheduled blast — Wednesday is usually clear.');
      return;
    }
    if(d.sent === 0){ toast('Nobody new to survey — everyone eligible has already been asked.'); return; }
    var msg = 'Send the win-back survey to ' + d.sent + ' lapsed customer' + (d.sent===1?'':'s') + '?'
      + '\n\nIt offers free delivery on their next order, unconditionally, and asks one question.'
      + (d.skipped ? '\n\n' + d.skipped + ' more will wait until tomorrow to stay within the daily email limit.' : '')
      + '\n\nNobody is asked twice.';
    if(!confirm(msg)) return;
    toast('Sending…');
    fetch(APPS_SCRIPT_URL, {
      method:'POST', headers:{'Content-Type':'text/plain'},
      body: JSON.stringify({type:'send_survey'})
    })
    .then(function(r){ return r.json(); })
    .then(function(res){
      if(res && res.success){ toast('📧 Sent to ' + res.sent); buildSurveyResults(true); }
      else toast('Send failed: '+((res&&res.error)||'unknown'));
    })
    .catch(function(){ toast('Network error — nothing sent'); });
  })
  .catch(function(){ toast('Network error'); });
}

function buildSurveyResults(force){
  var el = $('survey-results');
  if(!el) return;
  el.innerHTML = '<div style="font-size:12px;color:var(--t3)">Loading…</div>';
  fetch(APPS_SCRIPT_URL + '?type=get_survey_results')
    .then(function(r){ return r.json(); })
    .catch(function(){ return null; })
    .then(function(d){
      if(!d || !d.success){ el.innerHTML = '<div style="font-size:12px;color:var(--t3)">Could not load.</div>'; return; }
      if(!d.sent){ el.innerHTML = '<div style="font-size:12px;color:var(--t3)">Not sent yet.</div>'; return; }
      var rate = d.sent ? Math.round(d.responses/d.sent*100) : 0;
      var html = '<div style="font-size:12px;color:var(--t2);margin-bottom:10px">'
        + '<strong>'+d.responses+'</strong> replies from <strong>'+d.sent+'</strong> sent ('+rate+'%)</div>';
      var maxN = 0;
      Object.keys(d.counts).forEach(function(k){ if(d.counts[k] > maxN) maxN = d.counts[k]; });
      html += Object.keys(d.labels).map(function(k){
        var n = d.counts[k]||0;
        var w = maxN ? Math.round(n/maxN*100) : 0;
        return '<div style="margin-bottom:6px">'
          + '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px">'
          +   '<span style="color:var(--t2)">'+d.labels[k]+'</span><span style="color:var(--t3)">'+n+'</span></div>'
          + '<div style="background:#eee;border-radius:999px;height:6px"><div style="background:var(--f);height:6px;border-radius:999px;width:'+w+'%"></div></div>'
          + '</div>';
      }).join('');
      if(d.comments && d.comments.length){
        html += '<div style="font-size:12px;font-weight:700;color:var(--t2);margin:14px 0 6px">What they said</div>'
          + d.comments.map(function(m){
              return '<div style="background:#fafafa;border-radius:10px;padding:10px;margin-bottom:6px;font-size:12px;color:var(--t2)">'
                + '<div style="font-style:italic">&ldquo;'+m.comment+'&rdquo;</div>'
                + '<div style="font-size:11px;color:var(--t3);margin-top:4px">'+m.email+' · '+m.answer+'</div></div>';
            }).join('');
      }
      el.innerHTML = html;
    });
}

function setRetentionWindow(since){
  RETENTION_WINDOW = since;
  var a = $('rt-since-app'), b = $('rt-all-time');
  function on(el){ if(el){ el.style.background='var(--f)'; el.style.color='#fff'; el.style.borderColor='var(--f)'; } }
  function off(el){ if(el){ el.style.background='transparent'; el.style.color='var(--t2)'; el.style.borderColor='var(--bd)'; } }
  if(since){ on(a); off(b); } else { on(b); off(a); }
  RETENTION_STATS = RETENTION_CACHE[since] || null;
  buildRetentionStats();
}

// Finds the same person recorded under multiple emails. Every retention figure is
// computed per email, so duplicates split one person's history in two and make the
// churn picture look worse than it is.
function buildDuplicates(force){
  var el = $('dupe-results');
  if(!el) return;
  if(DUPE_DATA && !force){ renderDuplicates(DUPE_DATA); return; }
  el.innerHTML = '<div style="font-size:12px;color:var(--t3)">Checking…</div>';
  fetch(APPS_SCRIPT_URL + '?type=find_duplicates')
    .then(function(r){ return r.json(); })
    .catch(function(){ return null; })
    .then(function(d){
      if(!d || !d.success){ el.innerHTML = '<div style="font-size:12px;color:var(--t3)">Could not check.</div>'; return; }
      DUPE_DATA = d;
      renderDuplicates(d);
    });
}

function renderDuplicates(d){
  var el = $('dupe-results');
  if(!el) return;
  var groups = d.groups || [], sus = d.suspiciousNames || [];
  if(!groups.length && !sus.length){
    el.innerHTML = '<div style="font-size:12px;color:var(--t3)">No likely duplicates found across '+d.totalCustomers+' customers.</div>';
    return;
  }
  var html = '<div style="font-size:12px;color:var(--t2);margin-bottom:10px">'
    + '<strong>'+groups.length+'</strong> possible duplicate group'+(groups.length===1?'':'s')+' across '+d.totalCustomers+' customers. '
    + 'Each one inflates the customer count and splits that person\'s order history, which drags every retention number down.</div>';

  html += groups.map(function(g){
    return '<div style="background:#fff8e1;border-radius:10px;padding:10px;margin-bottom:6px">'
      + '<div style="font-size:11px;font-weight:700;color:#92400e;margin-bottom:4px">'+g.reason+'</div>'
      + g.members.map(function(m){
          return '<div style="font-size:11px;color:var(--t2);padding:2px 0">'
            + '<strong>'+(m.name||'(no name)')+'</strong> · '+m.email
            + (m.phone?' · '+m.phone:'')
            + (m.last?' · last '+m.last:'')
            + '</div>';
        }).join('')
      + '</div>';
  }).join('');

  if(sus.length){
    html += '<div style="font-size:12px;font-weight:700;color:var(--t2);margin:12px 0 4px">Records without a proper name</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-bottom:6px">These may be test entries or mis-typed signups rather than real customers.</div>'
      + sus.map(function(m){
          return '<div style="font-size:11px;color:var(--t2);padding:2px 0">'
            + '<strong>'+(m.name||'(blank)')+'</strong> · '+m.email + (m.last?' · last '+m.last:'')
            + '</div>';
        }).join('');
  }
  html += '<div style="font-size:11px;color:var(--t3);margin-top:10px;line-height:1.5">'
    + 'Nothing is changed automatically — merging records means editing the Customers sheet by hand, '
    + 'and it is worth confirming each pair is really the same person first.</div>';
  el.innerHTML = html;
}

function buildRetentionStats(){
  var el = $('retention-stats');
  if(!el) return;
  if(RETENTION_STATS){ renderRetentionStats(RETENTION_STATS); return; }
  el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--t3)">Loading analysis...</div>';
  fetch(APPS_SCRIPT_URL + '?type=get_retention_stats' + (RETENTION_WINDOW ? '&since='+RETENTION_WINDOW : ''))
    .then(function(r){ return r.json(); })
    .catch(function(){ return null; })
    .then(function(d){
      if(!d || !d.success){ el.innerHTML = '<div style="color:var(--t3);font-size:13px">Could not load analysis.</div>'; return; }
      RETENTION_STATS = d;
      RETENTION_CACHE[RETENTION_WINDOW] = d;
      renderRetentionStats(d);
    });
}

function renderRetentionStats(d){
  var el = $('retention-stats');
  if(!el) return;
  function stat(label, value, sub, color){
    return '<div style="background:#fafafa;border-radius:10px;padding:12px;text-align:center">'
      + '<div style="font-size:22px;font-weight:900;color:'+(color||'var(--f)')+'">'+value+'</div>'
      + '<div style="font-size:11px;font-weight:700;color:var(--t2);margin-top:2px">'+label+'</div>'
      + (sub?'<div style="font-size:10px;color:var(--t3);margin-top:1px">'+sub+'</div>':'')
      + '</div>';
  }
  function bar(label, count, total, color){
    var pct = total ? Math.round(count/total*100) : 0;
    return '<div style="margin-bottom:6px">'
      + '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px">'
      +   '<span style="color:var(--t2)">'+label+'</span>'
      +   '<span style="color:var(--t3)">'+count+' · '+pct+'%</span>'
      + '</div>'
      + '<div style="background:#eee;border-radius:999px;height:6px"><div style="background:'+color+';height:6px;border-radius:999px;width:'+pct+'%"></div></div>'
      + '</div>';
  }
  var f = d.frequency, r = d.recency, t = d.totalCustomers || 1;
  el.innerHTML =
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin-bottom:14px">'
    +   stat('Ever ordered', d.totalCustomers, 'across '+d.weeksTracked+' weeks')
    +   stat('Ordered again', d.repeatRate+'%', 'placed 2+ orders', d.repeatRate<40?'var(--cl)':'var(--f)')
    +   stat('Stuck around', d.thirdOrderRate+'%', 'placed 3+ orders', d.thirdOrderRate<25?'var(--cl)':'var(--f)')
    +   stat('Avg orders', d.avgOrdersPerCustomer, 'per customer')
    + '</div>'
    + (d.since ? '<div style="background:#f0f6ff;border-radius:8px;padding:8px 10px;margin-bottom:12px;font-size:11px;color:var(--t2);line-height:1.5">'
        + 'Showing orders from <strong>May 2026</strong> onward — after the app launched, with delivery fees, salads and saved profiles all in place. '
        + 'Customers who first ordered before this are excluded from the cohort chart. '
        + 'Note Lia took two weeks off in July, so that gap is a closure rather than customers drifting away.'
        + '</div>' : '')
    + '<div style="font-size:12px;font-weight:700;color:var(--t2);margin-bottom:6px">How many times people order</div>'
    + bar('Just once',      f.one,         t, '#ef4444')
    + bar('Twice',          f.two,         t, '#f59e0b')
    + bar('3–5 times',      f.three_five,  t, '#84cc16')
    + bar('6–10 times',     f.six_ten,     t, '#22c55e')
    + bar('11+ times',      f.eleven_plus, t, '#15803d')
    + '<div style="font-size:12px;font-weight:700;color:var(--t2);margin:14px 0 6px">When they last ordered</div>'
    + bar('Last 30 days',   r.d0_30,   t, '#22c55e')
    + bar('31–60 days',     r.d31_60,  t, '#84cc16')
    + bar('61–90 days',     r.d61_90,  t, '#f59e0b')
    + bar('Over 90 days',   r.d90_plus,t, '#ef4444')
    + '<div style="background:#fff8e1;border-radius:10px;padding:12px;margin-top:14px;font-size:13px;color:var(--t2);line-height:1.6">'
    +   '<strong style="color:#92400e">'+d.lapsedCount+' lapsed regulars</strong> — people who ordered at least twice '
    +   'but nothing in the last 8 weeks. They spent <strong>$'+d.lapsedHistoricValue.toLocaleString()+'</strong> historically, '
    +   'so they already know they like the food.'
    + '</div>'
    + renderMilestoneAnalysis(d);
}

// Lines the retention data up against the three things that actually changed the
// business: delivery fees (Jan 2026), the app launch (spring 2026), and salads
// (detected from the first week a salad column appears, rather than assumed).
function renderMilestoneAnalysis(d){
  var MILESTONES = {
    '2026-01': 'Delivery fees began',
    '2026-05': 'App launched'
  };
  if(d.saladFirstMonth) MILESTONES[d.saladFirstMonth] = (MILESTONES[d.saladFirstMonth] ? MILESTONES[d.saladFirstMonth]+' · ' : '') + 'Salads added';

  function mLabel(k){
    var p = k.split('-');
    var names = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return names[parseInt(p[1])] + " '" + p[0].slice(2);
  }

  // ── One-and-done, by the month of their single order ──
  var od = d.oneAndDoneByMonth || {};
  var odKeys = Object.keys(od).sort();
  var odMax = 0; odKeys.forEach(function(k){ if(od[k] > odMax) odMax = od[k]; });
  var odRows = odKeys.map(function(k){
    var w = odMax ? Math.round(od[k]/odMax*100) : 0;
    return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;font-size:11px">'
      + '<span style="width:52px;color:var(--t3);flex-shrink:0">'+mLabel(k)+'</span>'
      + '<div style="flex:1;background:#eee;border-radius:999px;height:6px"><div style="background:#ef4444;height:6px;border-radius:999px;width:'+w+'%"></div></div>'
      + '<span style="width:20px;text-align:right;color:var(--t3)">'+od[k]+'</span>'
      + (MILESTONES[k] ? '<span style="font-size:9px;color:var(--f);white-space:nowrap">← '+MILESTONES[k]+'</span>' : '')
      + '</div>';
  }).join('');

  // ── Cohort retention: did people who started in month X come back? ──
  var co = d.cohorts || {};
  var coKeys = Object.keys(co).sort().filter(function(k){ return co[k].size >= 3; });
  var coRows = coKeys.map(function(k){
    var x = co[k];
    var pct = Math.round(x.repeated/x.size*100);
    var color = pct >= 65 ? '#22c55e' : pct >= 45 ? '#84cc16' : '#f59e0b';
    return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;font-size:11px">'
      + '<span style="width:52px;color:var(--t3);flex-shrink:0">'+mLabel(k)+'</span>'
      + '<div style="flex:1;background:#eee;border-radius:999px;height:6px"><div style="background:'+color+';height:6px;border-radius:999px;width:'+pct+'%"></div></div>'
      + '<span style="width:70px;text-align:right;color:var(--t3)">'+pct+'% of '+x.size+'</span>'
      + (MILESTONES[k] ? '<span style="font-size:9px;color:var(--f);white-space:nowrap">← '+MILESTONES[k]+'</span>' : '')
      + '</div>';
  }).join('');

  // ── Salad buyers vs soup-only ──
  var sb = d.saladBuyers || {}, so = d.soupOnly || {};
  var saladBlock = (sb.customers || so.customers)
    ? '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px">'
      + '<div style="background:#f0faf0;border-radius:10px;padding:10px">'
      +   '<div style="font-size:11px;font-weight:700;color:var(--f);margin-bottom:4px">🥗 Buy salads</div>'
      +   '<div style="font-size:12px;color:var(--t2)">'+sb.customers+' customers<br>'
      +     '<strong>'+sb.avgOrders+'</strong> orders each · <strong>'+sb.repeatRate+'%</strong> reorder</div>'
      + '</div>'
      + '<div style="background:#fafafa;border-radius:10px;padding:10px">'
      +   '<div style="font-size:11px;font-weight:700;color:var(--t2);margin-bottom:4px">🥣 Soup only</div>'
      +   '<div style="font-size:12px;color:var(--t2)">'+so.customers+' customers<br>'
      +     '<strong>'+so.avgOrders+'</strong> orders each · <strong>'+so.repeatRate+'%</strong> reorder</div>'
      + '</div>'
      + '</div>'
    : '';

  // The honest salad test: only customers who started after salads existed, split by
  // whether their FIRST order included one. "Ever bought a salad" is circular, because
  // frequent buyers get more chances to try one.
  var fs = d.firstOrderSalad || {}, fn = d.firstOrderNoSalad || {};
  var firstSaladBlock = (fs.customers || fn.customers)
    ? '<div style="font-size:12px;font-weight:700;color:var(--t2);margin:16px 0 4px">Did a salad in their FIRST order matter?</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-bottom:6px">Only customers who started after salads were introduced, so everyone here had the choice.</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
      + '<div style="background:#f0faf0;border-radius:10px;padding:10px">'
      +   '<div style="font-size:11px;font-weight:700;color:var(--f);margin-bottom:4px">🥗 First order had a salad</div>'
      +   '<div style="font-size:12px;color:var(--t2)">'+(fs.customers||0)+' customers<br>'
      +     '<strong>'+(fs.avgOrders||0)+'</strong> orders each · <strong>'+(fs.repeatRate||0)+'%</strong> reorder</div>'
      + '</div>'
      + '<div style="background:#fafafa;border-radius:10px;padding:10px">'
      +   '<div style="font-size:11px;font-weight:700;color:var(--t2);margin-bottom:4px">🥣 First order was soup only</div>'
      +   '<div style="font-size:12px;color:var(--t2)">'+(fn.customers||0)+' customers<br>'
      +     '<strong>'+(fn.avgOrders||0)+'</strong> orders each · <strong>'+(fn.repeatRate||0)+'%</strong> reorder</div>'
      + '</div></div>'
    : '';

  // Members of any cohort that retained badly, so a bad month can be looked at directly
  var wc = d.weakCohorts || {};
  var wcKeys = Object.keys(wc).sort();
  var weakBlock = wcKeys.length
    ? '<div style="font-size:12px;font-weight:700;color:var(--t2);margin:16px 0 4px">Cohorts worth a closer look</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-bottom:6px">Months where 5+ people started but fewer than 40% came back.</div>'
      + wcKeys.map(function(k){
          return '<div style="background:#fff8e1;border-radius:10px;padding:10px;margin-bottom:6px">'
            + '<div style="font-size:12px;font-weight:700;color:#92400e;margin-bottom:4px">'+mLabel(k)+' — '+wc[k].length+' customers</div>'
            + wc[k].map(function(m){
                return '<div style="font-size:11px;color:var(--t2);padding:2px 0;display:flex;justify-content:space-between;gap:8px">'
                  + '<span>'+m.name+(m.firstHadSalad?' 🥗':'')+'</span>'
                  + '<span style="color:var(--t3);white-space:nowrap">'+m.orders+' order'+(m.orders===1?'':'s')+' · first '+m.firstWeek+'</span>'
                  + '</div>';
              }).join('')
            + '</div>';
        }).join('')
    : '';

  return '<div style="margin-top:18px;border-top:1px solid #eee;padding-top:14px">'
    + '<div style="font-size:12px;font-weight:700;color:var(--t2);margin-bottom:6px">When the one-and-done customers ordered</div>'
    + '<div style="font-size:11px;color:var(--t3);margin-bottom:8px">Clustered in the past means an old problem. Recent means something is losing people now.</div>'
    + (odRows || '<div style="font-size:12px;color:var(--t3)">No data</div>')
    + '<div style="font-size:12px;font-weight:700;color:var(--t2);margin:16px 0 6px">Did they come back? (by the month they first ordered)</div>'
    + (coRows || '<div style="font-size:12px;color:var(--t3)">No data</div>')
    + '<div style="font-size:12px;font-weight:700;color:var(--t2);margin:16px 0 0">Salads vs soup only</div>'
    + '<div style="font-size:11px;color:var(--t3);margin-bottom:4px">Read with care: frequent buyers get more chances to try a salad, so this overstates the effect. The first-order comparison below is the fair test.</div>'
    + saladBlock
    + firstSaladBlock
    + weakBlock
    + '<div style="font-size:11px;color:var(--t3);margin-top:12px;line-height:1.5">'
    +   'Delivery fees actually collected since they began in Jan 2026: <strong>$'+d.totalDelivery.toLocaleString()+'</strong>. '
    +   'A month of free delivery costs roughly one month of that.'
    + '</div>'
    + '</div>';
}

function buildRetentionMap(){
  var el = $('retention-heatmap');
  if(!el) return;
  if(RETENTION_DATA){
    renderRetentionMap(RETENTION_DATA);
    return;
  }
  el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--t3)">Loading order history...</div>';
  fetch(APPS_SCRIPT_URL + '?type=get_retention')
    .then(function(r){ return r.json(); })
    .catch(function(){ return null; })
    .then(function(d){
      if(!d || !d.weeks || !d.customers){
        el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--t3)">No retention data available</div>';
        return;
      }
      RETENTION_DATA = d;
      renderRetentionMap(d);
    });
}

function renderRetentionMap(d){
  var el = $('retention-heatmap');
  if(!el) return;
  var weeks     = d.weeks;
  var customers = d.customers;

  customers.sort(function(a,b){
    var aLast = a.orderWeeks.length ? Math.min.apply(null, a.orderWeeks) : 999;
    var bLast = b.orderWeeks.length ? Math.min.apply(null, b.orderWeeks) : 999;
    if(aLast !== bLast) return aLast - bLast;
    return b.orderWeeks.length - a.orderWeeks.length;
  });

  var BOX = 11, GAP = 2, NAME_W = 160;

  // Week header row
  var html = '<div style="display:flex;align-items:center;margin-bottom:4px">'
    +'<div style="width:'+NAME_W+'px;flex-shrink:0"></div>'
    +'<div style="width:60px;flex-shrink:0"></div>'
    +'<div style="display:flex;gap:'+GAP+'px">'
    +weeks.map(function(w,i){
      return '<div style="width:'+BOX+'px;text-align:center;font-size:7px;color:var(--t3);overflow:hidden">'
        +(i % 5 === 0 ? w.replace('Current','Now').replace(/Delivered /,'').replace(/\/\d{4}$/,'') : '')
        +'</div>';
    }).join('')
    +'</div></div>';

  html += customers.map(function(c){
    var weeksSet  = new Set(c.orderWeeks);
    var lastWeek  = c.orderWeeks.length ? Math.min.apply(null, c.orderWeeks) : 999;
    var isLapsed  = lastWeek >= 4;
    var total     = c.orderWeeks.length;

    var boxes = weeks.map(function(w, wi){
      var ordered = weeksSet.has(wi);
      var bg  = ordered ? '#22c55e' : '#e5e7eb';
      return '<div style="width:'+BOX+'px;height:'+BOX+'px;background:'+bg+';border-radius:2px;flex-shrink:0" title="'+w+'"></div>';
    }).join('');

    return '<div style="display:flex;align-items:center;margin-bottom:'+GAP+'px">'
      +'<div style="width:'+NAME_W+'px;flex-shrink:0;font-size:11px;font-weight:600;'
        +(isLapsed?'color:#dc2626;':'color:var(--f);')
        +'overflow:hidden;white-space:nowrap;text-overflow:ellipsis;padding-right:6px" title="'+c.email+'">'
        +(isLapsed?'⚠️ ':'')+c.name
        +' <span style="color:var(--t3);font-weight:400;font-size:10px">('+total+')</span>'
      +'</div>'
      +'<button onclick="sendOneReact(\''+c.email+'\',\''+c.name.replace(/'/g,'')+'\',this)" '
        +'style="width:56px;height:20px;font-size:9px;font-weight:700;border:none;border-radius:4px;cursor:pointer;flex-shrink:0;margin-right:4px;'
        +(isLapsed?'background:#fee2e2;color:#dc2626':'background:#f0faf0;color:var(--f)')+'">📤 Send</button>'
      +'<div style="display:flex;gap:'+GAP+'px">'+boxes+'</div>'
    +'</div>';
  }).join('');

  el.innerHTML = html;

  var lapsed = customers.filter(function(c){ return Math.min.apply(null, c.orderWeeks.concat([999])) >= 4; }).length;
  var active  = customers.length - lapsed;
  var summary = el.nextElementSibling;
  if(summary && summary.tagName === 'DIV') summary.remove();
  el.insertAdjacentHTML('afterend',
    '<div style="display:flex;gap:16px;font-size:11px;color:var(--t3);margin-top:8px;flex-wrap:wrap">'
    +'<span>👥 '+customers.length+' total</span>'
    +'<span style="color:#22c55e;font-weight:700">✅ '+active+' active</span>'
    +'<span style="color:#dc2626;font-weight:700">⚠️ '+lapsed+' lapsed</span>'
    +'</div>'
  );
}

function buildReact(){
  const today = new Date();
  today.setHours(0,0,0,0);
  $('reactl').innerHTML = REACT.map(r=>{
    // Recompute days from last order date dynamically
    const lastDate = new Date(r.last);
    const diffMs = today - lastDate;
    const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
    const icon = days >= 365 ? '🔴 ' : days >= 180 ? '🟠 ' : days >= 90 ? '🟡 ' : '🟢 ';
    const redClass = days > 180 ? 'text-red' : '';
    const phone = r.phone || '';
    return `
    <div class="react-card">
      <div class="rc-head">
        <strong>${esc(r.n)}</strong>
        <span class="${redClass}">${icon}${days} days ago</span>
      </div>
      <div class="rc-meta">${esc(r.orders)} lifetime orders · Last: ${esc(r.last)}</div>
      <div class="rc-meta" style="margin-top:2px;color:var(--t3);font-size:10px">${esc(r.email)}${phone ? ' · 📱 '+esc(phone) : ''}</div>
      <button class="react-btn" onclick="sendReact(this)" data-name="${esc(r.n)}" data-email="${esc(r.email)}" data-phone="${esc(phone)}">💌 Send SMS &amp; Email</button>
    </div>`;
  }).join('');
}

// S-011 (v254): the "send to all lapsed customers" buttons are gone. They emailed everyone
// with no email budget, so one tap could stop the day's order confirmations. Bulk win-back
// is Recapture → Send… (dry-run count, keeps the reserve, tracks returns).
function sendReact(btn){
  const name = btn && btn.dataset ? btn.dataset.name : btn;
  const email = btn && btn.dataset ? btn.dataset.email : '';
  const phone = btn && btn.dataset ? btn.dataset.phone : '';
  // The message is the WELCOMEBACK code, which is paused during the anniversary (the
  // checkout would refuse it). Lapsed regulars get the anniversary email automatically.
  if(welcomebackPaused()){
    toast('WELCOMEBACK is paused while delivery is free this month. Lapsed regulars get the anniversary email automatically on Wednesdays.');
    return;
  }
  if(!confirm('Email ' + name + ' the WELCOMEBACK offer (10% off their next order)?')) return;
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳ Sending…';
  fetch(APPS_SCRIPT_URL, {
    method:  'POST',
    body:    JSON.stringify({ type: 'send_reengagement', name, email, phone }),
    headers: { 'Content-Type': 'text/plain' }
  })
  .then(function(r){ return r.json(); })
  .then(function(d){
    // S-026: say what really happened. The front door queues this one, so "queued" is
    // the honest answer; a refusal (unsubscribed, paused) comes back as success:false.
    if(!d || d.success === false){
      btn.disabled = false; btn.textContent = label;
      toast('⚠️ Not sent: ' + ((d && d.error) || 'unknown error'));
      return;
    }
    btn.textContent = '✅ Sent!';
    btn.style.background = 'var(--sg)';
    toast(d.queued ? '📨 Offer for ' + name + ' is on its way (sending in the background).' : '📱✉️ Offer sent to ' + name + '!');
  })
  .catch(function(err){
    btn.disabled = false;
    btn.textContent = label;
    toast('⚠️ Send failed — check connection');
    console.log('Re-engage error:', err.message);
  });
}

function buildAreas(){
  var flyerEl = $('flyer-streets');
  var listEl  = $('areal');
  if(!flyerEl) return;

  // Build street data from AREAS (from intelligence engine) + current week orders
  var streetMap = {};

  // Pull from AREAS (historical all-time customer data)
  (AREAS||[]).forEach(function(a){
    var street = a.n || '';
    if(!street) return;
    if(!streetMap[street]) streetMap[street] = {name: street, customers: 0, orders: 0, score: 0, thisWeek: false};
    streetMap[street].customers = Math.max(streetMap[street].customers, a.custs || 0);
    streetMap[street].orders    = Math.max(streetMap[street].orders, a.del || 0);
    streetMap[street].score     = Math.max(streetMap[street].score, a.score || 0);
  });

  // Overlay this week's orders to flag active streets
  (ORDERS||[]).forEach(function(o){
    var addr = (o.addr || o.address || '').toString();
    var street = extractStreet(addr);
    if(!street) return;
    if(!streetMap[street]) streetMap[street] = {name: street, customers: 1, orders: 1, score: 1, thisWeek: true};
    else streetMap[street].thisWeek = true;
  });

  var streets = Object.values(streetMap).sort(function(a,b){ return b.score - a.score; });

  if(!streets.length){
    flyerEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--t3)">Customer address data not yet loaded — visit Orders tab first</div>';
    return;
  }

  var max = streets[0].score || 1;

  flyerEl.innerHTML = streets.slice(0, 20).map(function(s, i){
    var pct     = Math.round((s.score / max) * 100);
    var isHot   = s.customers >= 4;
    var isWarm  = s.customers >= 2 && !isHot;
    var badge   = isHot ? '🔥 HOT' : isWarm ? '🟡 WARM' : '📍 NEW';
    var badgeColor = isHot ? '#dc2626' : isWarm ? '#d97706' : '#6b7280';
    var barColor   = isHot ? 'var(--f)' : isWarm ? 'var(--am)' : '#ccc';
    return '<div class="ccrd" style="padding:10px 14px">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
        +'<div>'
          +'<span style="font-weight:700;font-size:14px">'+(i+1)+'. '+s.name+'</span>'
          +(s.thisWeek ? ' <span style="font-size:10px;background:#dcfce7;color:#166534;border-radius:4px;padding:1px 5px;font-weight:700">Delivering this week</span>' : '')
        +'</div>'
        +'<span style="font-size:11px;font-weight:800;color:'+badgeColor+'">'+badge+'</span>'
      +'</div>'
      +'<div style="display:flex;gap:16px;font-size:12px;color:var(--t3);margin-bottom:6px">'
        +'<span>👥 '+s.customers+' customer'+(s.customers!==1?'s':'')+'</span>'
        +'<span>📦 '+s.orders+' orders</span>'
      +'</div>'
      +'<div style="background:#f0f0f0;border-radius:4px;height:6px;overflow:hidden">'
        +'<div style="width:'+pct+'%;height:100%;background:'+barColor+';border-radius:4px;transition:width .5s"></div>'
      +'</div>'
      +'<div style="font-size:11px;color:var(--t3);margin-top:6px">'
        +(isHot ? '✅ Great flyer street — neighbors likely see Lia\'s deliveries already'
         : isWarm ? '👍 Good target — 1-2 customers will vouch if asked'
         : '💡 Expansion opportunity — no customers yet on this street')
      +'</div>'
    +'</div>';
  }).join('');

  // Also update the legacy areal list
  if(listEl) listEl.innerHTML = (AREAS||[]).slice(0,8).map(function(a,i){
    return '<div class="ac">'
      +'<div class="ah" style="background:'+(i<2?'var(--f)':i<4?'var(--am)':'var(--sg)')+'">'+( i<2?'🔥':'📍')+'</div>'
      +'<div class="ai"><strong>'+a.n+'</strong><span>'+a.custs+' customers · '+a.del+' deliveries</span></div>'
      +'<div class="ap"><strong>'+a.del+'</strong><span>drops</span></div>'
    +'</div>';
  }).join('');
}

function extractStreet(addr){
  if(!addr) return '';
  var cleaned = addr.replace(/\b(apt|suite|ste|unit|#)\s*\w+/gi,'').trim();
  var parts = cleaned.split(',')[0].split(' ');
  if(parts.length < 2) return '';
  var street = parts.slice(1).join(' ').replace(/\s+/g,' ').trim();
  var commonWords = /^(st|ave|blvd|dr|rd|ln|ct|way|pl|cir|pkwy|hwy)$/i;
  var words = street.split(' ');
  var cleaned2 = words.filter(function(w){ return w.length > 1; }).join(' ');
  return cleaned2.length > 2 ? cleaned2 : '';
}

function setPlt(btn){document.querySelectorAll('.pb').forEach(b=>b.classList.remove('active'));btn.classList.add('active');}

function copyCaption(){
  const text = ($('ptxtarea')||{value:''}).value.trim();
  if(!text){ toast('Write a caption first!'); return; }
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text)
      .then(function(){ toast('📋 Copied! Now open Instagram or Facebook and paste.'); })
      .catch(function(){ fallbackCopy(text); });
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text){
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    toast('📋 Copied! Now open Instagram or Facebook and paste.');
  } catch(e) {
    toast('⚠️ Could not copy — select the text manually and copy it');
  }
  document.body.removeChild(ta);
}

// Ready. index.html's window.onload used to build every admin screen at start-up; they
// are built here instead, once, when this file arrives.
window.ADMIN_JS = 'ready';
(function adminStart(){
  [buildDash, buildOrders, buildCusts, buildReact, buildAreas, buildWkMenu, buildSoupIntel, buildRatings, buildMonthly]
    .forEach(function(f){ try { f(); } catch(e){ console.log('admin start ' + f.name + ':', e); } });
  if($('sch-vac-start')) try { buildScheduleAdmin(); } catch(e){}
  if(typeof RT_JOBS !== 'undefined' && RT_JOBS.some(function(j){ return j.state === 'waiting'; })) rtRunJobs();
})();
