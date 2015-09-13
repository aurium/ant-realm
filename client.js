var ctx = c.getContext('2d'),
    d = document,
    de = d.documentElement,
    b = d.body,
    w = 0,
    h = 0,
    viewX = 2500,
    viewY = 1700,
    incViewX = 0,
    incViewY = 0,
    incViewAcel = 1,
    gardenW = 6000,
    gardenH = 4000,
    mapProportion = 40,
    playerName = docCookies.getItem('ants-playerName') || '',
    sessionID = docCookies.getItem('ants-sessionID'),
    anthills = {},
    antTic = 0,
    ants = {},
    antsTarget = {},
    ACTION_FINDFOOD = 1,
    ACTION_BACKHOME = 2,
    ACTION_FIGHT = 3,
    lifetime = 0,
    pheromones = {},
    pheromonesSrv = {}, // DEBUG ONLY
    candies = {},
    proportionWork = 90,
    proportionWarr = 10,
    round = Math.round,
    rnd = function(n){ return Math.random()*(n||1) },
    rndR = function(n){ return round(rnd(n)) }
    now = Date.now,
    lastAntUpdate = now(),
    lastTic = now(),
    ticDelay = 0,
    start = now();

function timeToStr(time) {
  var hours, mins, secs;
  time = round(time/1000);
  time -= secs = time % 60;
  mins = round(time/60) % 60;
  hours = round((time/60-mins)/60);
  if (secs<10) secs = '0'+secs;
  if (mins<10) mins = '0'+mins;
  return hours + ':' + mins + ':' + secs;
}

function updateMiniMap() {
  var s = view.style;
  s.width = Math.round(w/mapProportion) + 'px';
  s.height = Math.round(h/mapProportion) + 'px';
  s.top = Math.round(viewY/mapProportion) + 'px';
  s.left = Math.round(viewX/mapProportion) + 'px';
}

(window.onresize = function() {
  c.width = w = de.clientWidth - 200;
  c.height = h = de.clientHeight;
  updateMiniMap();
})();

for (var el,i=0; el=d.getElementsByClassName('mv')[i]; i++) {
  el.onmouseover = function(){
    incViewX = parseInt(this.getAttribute('x'));
    incViewY = parseInt(this.getAttribute('y'));
  };
  el.onmouseout = function(){
    incViewX = 0;
    incViewY = 0;
  };
}

d.onkeydown = function (ev) {
  switch (ev.keyCode) {
    case 38: incViewX=0; incViewY=-1; break;
    case 40: incViewX=0; incViewY=+1; break;
    case 37: incViewX=-1; incViewY=0; break;
    case 39: incViewX=+1; incViewY=0; break;
  }
}
d.onkeyup = function (ev) {
  switch (ev.keyCode) {
    case 38: incViewY=0; break;
    case 40: incViewY=0; break;
    case 37: incViewX=0; break;
    case 39: incViewX=0; break;
  }
}

var pseudoRandPx = function(x, y, level) {
  return (x*y+start) % ((((x+1e4)/(y+1e3))%77)+13) % (level||10);
};

var coord2index = function(x, y, w, h) {
  var index = w*(y+h/2) + x+w/2;
  return (index < 0)? 0 : index;
};

function grass() {
  gW = 30, gH = 20
  if (!grass.cache) {
    cTMP.width = gW;
    cTMP.height = gH;
    var ctxG = cTMP.getContext('2d');
    for (var y=-3; y<4; y++) {
      for (var x=-3; x<4; x++) {
        var grd = ctxG.createLinearGradient(0,10*y, 0,10*y+35);
        grd.addColorStop(0, '#0F0');
        grd.addColorStop(1, '#070');
        ctxG.fillStyle = grd;
        ctxG.beginPath();
        var inc = y%2 ? 15 : 0;
        ctxG.moveTo(30*x+6+inc,10*y+35);
        ctxG.bezierCurveTo(30*x+6+inc,10*y+12,  30*x+15+inc,10*y,  30*x+15+inc,10*y);
        ctxG.bezierCurveTo(30*x+15+inc,10*y, 30*x+24+inc,10*y+12, 30*x+24+inc,10*y+35);
        ctxG.fill();
        ctxG.closePath();
      }
    }
    grass.cache = ctxG.getImageData(0, 0, gW, gH);
  }
  for (y=-viewY%gH; y<h; y+=gH) {
    for (x=-viewX%gW; x<w; x+=gW) {
      ctx.putImageData(grass.cache, x, y);
    }
  }
}

function drawAnthill(anthill) {
  if (!anthill.img) {
    cTMP.width = 300;
    cTMP.height = 100;
    var ctxH = cTMP.getContext('2d');
    ctxH.clearRect(0, 0, 300, 100);
    ctxH.fillStyle = '#950';
    ctxH.beginPath();
    ctxH.arc(150, 50, 25, 0,7);
    ctxH.closePath();
    ctxH.fill();
    var g = Math.random()*.3+.6;
    var b = Math.random()-.5;
    if (b<0) b=.3;
    for (var y=-50; y<50; y+=2) {
      for (var x=-50; x<50; x+=2) {
        var i = coord2index(x,y,100,100);
        var r = 80 + Math.random()*150;
        var a = Math.random()*20;
        var dist = x*x + y*y;
        if (a>(dist/160) && a<15 ) {
          ctxH.fillStyle = 'rgb('+Math.round(r)+','+
                                  Math.round(r*g)+','+
                                  Math.round(r*b)+')';
          ctxH.beginPath();
          ctxH.arc( x+150, y+50, 2, 0,7 );
          ctxH.closePath();
          ctxH.fill();
        }
      }
    }
    grd = ctxH.createRadialGradient(150, 50, 0, 150, 50, 15);
    grd.addColorStop(0, 'rgb(30,10,0)');
    grd.addColorStop(0.5, 'rgb(30,10,0)');
    grd.addColorStop(1, 'rgba(30,10,0,0)');
    ctxH.fillStyle = grd;
    ctxH.beginPath();
    ctxH.arc( 150, 50, 15, 0,7 );
    ctxH.closePath();
    ctxH.fill();
    ctxH.font = 'bold 14px sans-serif';
    ctxH.fillStyle = anthill.color; //'#420';
    ctxH.textAlign = 'center';
    ctxH.strokeStyle = 'rgba(50,250,50,0.6)';
    ctxH.lineWidth = 4;
    ctxH.lineJoin = "round";
    ctxH.strokeText(anthill.owner, 150, 97);
    ctxH.fillText(anthill.owner, 150, 97);
    // Crate an <img> element to store the drawing:
    anthill.img = d.createElement('img');
    anthill.img.src = cTMP.toDataURL();
    // Put the hill on minimap:
    anthill.el = d.createElement('div');
    anthill.el.className = 'anthill';
    if (anthill.owner == playerName) anthill.el.className += ' mine';
    anthill.el.style.left = anthill.x/mapProportion-3;
    anthill.el.style.top  = anthill.y/mapProportion-3;
    map.appendChild(anthill.el);
  }
  ctx.drawImage(anthill.img, anthill.x-viewX-150, anthill.y-viewY-50);
}

function drawCandy(candy, antCatch) {
  if (( (candy.x-viewX) < -5 || (candy.x-viewX) > w+5
     || (candy.y-viewY) < -5 || (candy.y-viewY) > h+5
     || candy.ant ) && !antCatch) return;
  ctx.save();
  if (antCatch) ctx.translate(candy.x, candy.y);
  else ctx.translate(candy.x-viewX, candy.y-viewY);
  grd = ctx.createRadialGradient(-1, -1, 0, -1, -1, 5);
  grd.addColorStop(0, '#FCF');
  grd.addColorStop(.8, candy.color[0]);
  grd.addColorStop(1, candy.color[1]);
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc( 0, 0, 6, 0,7 );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawAnt(ant) {
  var antFuture = antsTarget[ant.id];
  if (!antFuture || antFuture.inside) return;
  var pct = (now()-lastAntUpdate)/500;
  if (pct>1) pct=1;
  var x = ant.x*(1-pct) + antFuture.x*pct - viewX;
  var y = ant.y*(1-pct) + antFuture.y*pct - viewY;
  var a = ant.a*(1-pct) + antFuture.a*pct;
  if ( x < -5 || x > w+5 || y < -5 || y > h+5 ) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  var candy = candies[antFuture.candy];
  if (candy) {
    candy.x = 8;
    candy.y = 0;
    drawCandy(candy, true);
  }
  ctx.strokeStyle = (ant.owner==playerName)? '#000' : anthills[ant.owner].color;
  // Body
  ctx.lineCap = 'round';
  ctx.setLineDash([0.1, 4 + ant.type]);
  ctx.lineWidth = 4 + ant.type*2;
  ctx.beginPath();
  ctx.moveTo(-5 - ant.type, 0);
  ctx.lineTo(+5 + ant.type, 0);
  ctx.stroke();
  ctx.closePath();
  // Legs
  var step = Math.round(now()/100) % 4 - 1;
  if (step > 1) step = 0;
  ctx.beginPath();
  ctx.moveTo(-3-step, -5 - ant.type);
  ctx.lineTo(-3+step, +5 + ant.type);
  ctx.moveTo(-step,   +5 + ant.type);
  ctx.lineTo(+step,   -5 - ant.type);
  ctx.moveTo(3-step,  -5 - ant.type);
  ctx.lineTo(3+step,  +5 + ant.type);
  ctx.setLineDash([1.5 + ant.type*.5, 7 + ant.type]);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.closePath();
  // Jaw
  if (ant.type==1) {
    ctx.beginPath();
    ctx.moveTo(9, -1.5 + step/2);
    ctx.lineTo(4, -1.5);
    ctx.lineTo(4, +1.5);
    ctx.lineTo(9, +1.5 - step/2);
    ctx.setLineDash([]);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.closePath();
  }
  // Angry
  if (antFuture.act==ACTION_FIGHT) {
    ctx.fillStyle = 'rgba(255,0,0,'+((3+step)/6)+')';
    ctx.beginPath();
    ctx.arc( 3.7+ant.type, 0, 2+ant.type, 0,7 );
    ctx.closePath();
    ctx.fill();
  }
  // Antennas
  ctx.beginPath();
  ctx.moveTo(7 + ant.type + step/2, -5);
  ctx.lineTo(5 + ant.type, 0);
  ctx.lineTo(7 + ant.type - step/2, +5);
  ctx.setLineDash([]);
  ctx.lineWidth = 0.5;
  ctx.stroke();
  ctx.closePath();
  // Done
  ctx.restore();
}

function drawPheromones() {
  for ( var id in pheromones ) {
    var pheromone = pheromones[id];
    var time = 1e5 + pheromone.t-lastAntUpdate;
    var x=pheromone.x-viewX, y=pheromone.y-viewY;
    if ( x > 0 && x < w && y >0 && y < h ) {
      var color = (pheromone.a==ACTION_BACKHOME)? '255,220,100,' : '0,100,0,';
      ctx.fillStyle = 'rgba('+color+(.2+time/1e5)+')';
      ctx.beginPath();
      ctx.arc( x, y, 1.5, 0,7 );
      ctx.closePath();
      ctx.fill();
    }
    if (time<1) delete pheromones[id];
  }
}

window.requestAnimationFrame =
  window.requestAnimationFrame ||
  window.mozRequestAnimationFrame ||
  window.webkitRequestAnimationFrame ||
  window.msRequestAnimationFrame ||
  function(fn){ setTimeout(fn, 33); };

lastTic = now();
function tic() {
  var N = now();
  ticDelay = N-lastTic;
  lastTic = N;
  debug.innerHTML = Math.round(1000/ticDelay) + 'fps';
  viewX += incViewX*incViewAcel;
  viewY += incViewY*incViewAcel;
  if ( incViewX==0 && incViewY==0 ) incViewAcel = 2;
  if ( incViewAcel<100 ) incViewAcel+=0.2;
  if (viewX < 0) viewX = 0;
  if (viewX+w > gardenW) viewX = gardenW-w;
  if (viewY < 0) viewY = 0;
  if (viewY+h > gardenH) viewY = gardenH-h;
  updateMiniMap();
  grass();
  drawPheromones();
  for ( var owner in anthills ) drawAnthill(anthills[owner]);
  for ( var num in candies ) drawCandy(candies[num]);
//  var pheromSrv = pheromonesSrv[playerName]; // DEBUG ONLY
//  if (pheromSrv) { // DEBUG ONLY
//    for ( var pID in pheromSrv.pathHome ) { // DEBUG ONLY
//      var pheromone = pheromSrv.pathHome[pID];
//      ctx.strokeStyle = '#FFF';
//      ctx.beginPath();
//      ctx.arc( pheromone.x-viewX, pheromone.y-viewY, 4, 0,7 );
//      ctx.moveTo( pheromone.x-viewX, pheromone.y-viewY );
//      ctx.lineTo( pheromone.x-viewX+pheromone.vx*8, pheromone.y-viewY+pheromone.vy*8 );
//      ctx.lineWidth = .2 + pheromone.force/100;
//      ctx.stroke();
//      ctx.closePath();
//    }
//    for ( var pID in pheromSrv.pathFood ) { // DEBUG ONLY
//      var pheromone = pheromSrv.pathFood[pID];
//      ctx.strokeStyle = '#FE0';
//      ctx.beginPath();
//      ctx.arc( pheromone.x-viewX, pheromone.y-viewY, 4, 0,7 );
//      ctx.moveTo( pheromone.x-viewX, pheromone.y-viewY );
//      ctx.lineTo( pheromone.x-viewX+pheromone.vx*8, pheromone.y-viewY+pheromone.vy*8 );
//      ctx.lineWidth = .2 + pheromone.force/100;
//      ctx.stroke();
//      ctx.closePath();
//    }
//  }
  for ( var id in ants ) drawAnt(ants[id]);
  updateAntCounter();
  window.requestAnimationFrame(tic);
};
tic();

qtdWorkN.val = 0;
qtdWorkG.val = 0;
qtdWarrN.val = 0;
qtdWarrG.val = 0;
function updateAntCounter() {
  var qWorkN = 0, qWorkG = 0, qWarrN = 0, qWarrG = 0;
  for ( var id in ants ) {
    var ant = ants[id];
    if ( ant.owner == playerName ) {
      if ( ant.type == 0 ) ant.inside ? qWorkN++ : qWorkG++;
      else ant.inside ? qWarrN++ : qWarrG++;
    }
  }
  if ( qtdWorkN.val != qWorkN ) qtdWorkN.innerHTML = qtdWorkN.val = qWorkN;
  if ( qtdWorkG.val != qWorkG ) qtdWorkG.innerHTML = qtdWorkG.val = qWorkG;
  if ( qtdWarrN.val != qWarrN ) qtdWarrN.innerHTML = qtdWarrN.val = qWarrN;
  if ( qtdWarrG.val != qWarrG ) qtdWarrG.innerHTML = qtdWarrG.val = qWarrG;
}

propWork.onclick = function() {
   if (proportionWork<100) {
     propWorkV.innerHTML = (proportionWork += 5) + '%';
     propWarrV.innerHTML = (proportionWarr -= 5) + '%';
   }
   socket.emit('proportion', { work:proportionWork, warr:proportionWarr });
};

propWarr.onclick = function() {
   if (proportionWarr<100) {
     propWorkV.innerHTML = (proportionWork -= 5) + '%';
     propWarrV.innerHTML = (proportionWarr += 5) + '%';
   }
   socket.emit('proportion', { work:proportionWork, warr:proportionWarr });
};

function onNews(message) {
  console.log('message:', message);
  var msg = d.createElement('p');
  msg.className = 'show';
  msg.innerHTML = message;
  //messageBox.appendChild(msg);
  messageBox.insertBefore(msg, messageBox.firstChild);
  setTimeout(function(){ msg.className = '' }, 2000);
  setTimeout(function(){ messageBox.removeChild(msg) }, 20*1000);
}

var endGameMsg = 'The server connection was dropped.';
function onDisconnect(data) {
  connected = false;
  console.log('disconnected', data);
  openDialog(
    'Disconnected', endGameMsg+'<br>Do you want to reconnect?',
    'Reconnect', function() {
      document.location.reload();
      dialog.style.display = 'none';
  });
}

function openNameDialog() {
  openDialog(
    'Welcome',
    'What is your name?' +
    '<form onsubmit="getName(); return false">' +
    '<input id="playerNameInput" value="'+playerName+'"></form>',
    'Enter', getName
  );
  dialogBtClose.style.display = 'none';
  playerNameInput.focus();
}

function getName() {
  playerName = playerNameInput.value.replace(/^\s*|\s*$/g, '');
  if ( playerName ) {
    docCookies.setItem('ants-playerName', playerName, Infinity);
    dialog.style.display = 'none';
    if (anthillPlace) requestPlace();
    else selectPlace();
  }
  else openNameDialog()
}

var anthillPlace = null;
function selectPlace() {
  onNews('Select a place to build your anthill.');
  garden.style.cursor = 'pointer';
  garden.onclick = function(ev) {
    console.log(ev);
    anthillPlace = { x: ev.layerX + viewX, y: ev.layerY + viewY }
    requestPlace();
    garden.onclick = null;
    garden.style.cursor = null;
  };
}

function requestPlace() {
  console.log('playerName', playerName);
  socket.emit('requestPlace', {x:anthillPlace.x, y:anthillPlace.y, name:playerName});
}

function openDialog(title, content, btLabel, btFunc) {
  console.log('open dialog', title, dialog);
  dialog.style.display = 'block';
  dialogTitle.innerHTML = title;
  dialogContent.innerHTML = content;
  dialogBtFunc.innerHTML = btLabel || 'Ok';
  dialogBtFunc.onclick = btFunc || function(){ dialog.style.display = 'none' };
  dialogBtClose.style.display = 'block';
}


///// GAME START ///////////////////////////////////////////////////////////////

console.log('connecting...');

var socket = io(document.location.href);
socket.on('news', onNews);
socket.on('requestName', openNameDialog);
socket.on('disconnect', onDisconnect);
socket.on('pheromones', function(data){ pheromonesSrv = data }); // DEBUG ONLY
socket.on('candies', function(data){ candies = data });
socket.on('food', function(data){ qtdFood.innerHTML = data });
socket.on('queenFood', function(data){ queenFood.innerHTML = data });
socket.on('lifetime', function(data){ lifetimeEl.innerHTML = timeToStr(lifetime=data) });
socket.on('record', function(data){
  record.innerHTML = 'Record: '+data.user +' - lifetime: '+timeToStr(data.lifetime);
});
socket.on('ants', function(data){
//  var old = ants;
//  ants = data;
//  for (var id in ants) if (old[id]) ants[id].a = (ants[id].a + old[id].a*3) / 4;
  lastAntUpdate = now();
  if (++antTic%3==0)
    for (var id in ants) {
      var ant = ants[id];
      if (!ant.inside && ( ant.act!=ACTION_BACKHOME || ant.candy ) )
        pheromones[rnd()] = { x:ant.x, y:ant.y, t:lastAntUpdate, a:ant.act };
    }
  ants = antsTarget;
  antsTarget = data;
});
socket.on('anthills', function(data){
  var old = anthills;
  anthills = data;
  for (var name in anthills) if (old[name]) anthills[name].img = old[name].img;
});
socket.on('anthillDone', function(data){
  docCookies.setItem('ants-sessionID', sessionID=data, Infinity);
  cmd.style.display = 'block';
  openDialog(
    'Wellcome '+playerName,
    'At the left you can see the commands that you, the Ant Queen, can send.' +
    ' (It is scrollable!)' +
    ' This commands are pheromones and will last some seconds. <hr>' +
    'You have two kinds of ants: workers and warriors, you will recognize by size.' +
    ' Warriors will not get food for you, but it fight better.' +
    ' Your ants are allways black. <hr>' +
    'You can move the map touching on its edges, or using your keyboard arrows. <hr>' +
    'You can close this page and back to command your ants again,' +
    ' <b>if</b> the anthill still alive.'
  );
});
socket.on('gameOver', function(data){
  openDialog(
    'Game Over',
    '<b>'+ data +'</b><p/>' +
    'Your anthill survive for '+ timeToStr(lifetime)
  );
});

function btCmdPressed(bt, secs) {
  bt.className = 'on';
  setTimeout(function(){ bt.className='' },(secs||8)*1000);
}

btHome.onclick = function() { btCmdPressed(this); socket.emit('cmd', 'goHome') }
btFood.onclick = function() { btCmdPressed(this); socket.emit('cmd', 'getFood') }
btAttack.onclick = function() { btCmdPressed(this); socket.emit('cmd', 'attack') }
btN.onclick = function() { btCmdPressed(this,3); socket.emit('cmd', 'goN') }
btS.onclick = function() { btCmdPressed(this,3); socket.emit('cmd', 'goS') }
btW.onclick = function() { btCmdPressed(this,3); socket.emit('cmd', 'goW') }
btE.onclick = function() { btCmdPressed(this,3); socket.emit('cmd', 'goE') }

if (/mobile|android|iPhone/i.test(navigator.userAgent)) {
  d.onclick = function() {
    if (d.fullScreenEnabled) b.requestFullscreen();
    if (d.mozFullScreenEnabled) b.mozRequestFullScreen();
    if (d.webkitFullscreenEnabled) de.webkitRequestFullScreen();
  }
}

setTimeout(tic, 10);

if ( sessionID ) socket.emit('recoverSession', sessionID);
else openNameDialog();

