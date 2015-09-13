'use strict';

var gardenW = 6000,
    gardenH = 4000,
    users = {},
    ants = {},
    ACTION_FINDFOOD = 1,
    ACTION_BACKHOME = 2,
    ACTION_FIGHT = 3,
    lastAntNum = 0,
    candies = {},
    lastCandyID = 0,
    tics = 0,
    cos = Math.cos,
    sin = Math.sin,
    round = Math.round,
    rnd = function(n){ return Math.random()*(n||1) },
    rndR = function(n){ return round(rnd(n)) },
    now = Date.now,
    tps = 0, // tics per second
    lastTicTmp = 0,
    lastTic = now(),
    ticDelay = 500,
    record = db('record') || {user:'nobody', lifetime:0},
    io = require('sandbox-io');

log.debug('record', record)

io.on('connection', function(socket) {
  log.info('New connection', socket.id);
  socket.emit('news', 'Connected!');
  emitAnthills(socket);
  socket.on('requestPlace', userRequestPlace);
  socket.on('recoverSession', recoverSession);
  socket.on('proportion', updateProportion);
  socket.on('cmd', execCommand);
});

function updateProportion(data) {
  log.debug('Proportion Update', this.antUser.name, data);
  if (this.antUser) this.antUser.proportion = data;
}

function getAnthills() {
  var anthills = {};
  for (var name in users) anthills[name] = {
    owner: name,
    x: users[name].anthill.x,
    y: users[name].anthill.y,
    color: users[name].color
  };
  return anthills;
}

function emitAnthills(socket) {
  socket.emit('anthills', getAnthills());
}

function execCommand(cmd) {
  var usr = this.antUser;
  log.debug('Command!', usr.name, cmd);
  usr.currentCMD = cmd;
  if (usr.cmdTimeout) clearTimeout(usr.cmdTimeout);
  var timeout = ( 'goHomegetFoodattack'.indexOf(cmd)>-1 )? 8 : 3;
  usr.cmdTimeout = setTimeout(function(){ usr.currentCMD=null }, timeout*1000);
}

var antNames = 'And Ami Cly Ceu Den Dim Fye Fin Gio Guu Mia Zee Zed'.split(' ');
function createAnt(userName, type) {
  var owner = users[userName];
  var id = antNames[rndR(antNames.length-1)] +' '+ ++lastAntNum;
  if (!type) type = (owner.proportion.work < (owner.qWork / owner.qtd)*100)? 1 : 0;
  ants[id] = {
    id: id,
    x: owner.anthill.x,
    y: owner.anthill.y,
    a: rnd(6.28),
    life: (type==0)? 20 : 40,
    food: 500,
    born: tics,
    owner: userName,
    act: ACTION_FINDFOOD,
    type: type,
    inside: true     // born inside neast.
  };
}

function dist(x1,y1, x2,y2) {
  var c1 = x1 - x2;
  var c2 = y1 - y2;
  return Math.sqrt( c1*c1 + c2*c2 );
}

function nearToAnAnthill(x,y) {
  for (var name in users) {
    var anthill = users[name].anthill;
    if ( dist(x,y, anthill.x,anthill.y) < 250 ) return true;
  }
  return false;
}

function dropCandies() {
  var x = gardenW*.25 + rnd(gardenW*.5);
  var y = gardenH*.25 + rnd(gardenH*.5);
  while ( nearToAnAnthill(x,y) || nearToGroupElement({x:x,y:y}, candies, 100).ent ) {
    x = gardenW*.05 + rnd(gardenW*.9);
    y = gardenH*.05 + rnd(gardenH*.9);
  }
  for (var i=0; i<30; i++) setTimeout(function(){
    if (rnd(2)<1) {
      r = 255;
      b = rndR(255);
    } else {
      b = 255;
      r = rndR(255);
    }
    candies[++lastCandyID] = {
      id: lastCandyID,
      x: x + rnd(50)-25,
      y: y + rnd(50)-25,
      ant: null,
      color: ['rgb('+r+',0,'+b+')', 'rgb('+round(r/2)+',0,'+round(b/2)+')']
    }
  }, 500*i);
}

function recoverSession(sessionID) {
  log.info('recoverSession', sessionID);
  io.emit('record', record); // update to everybody.
  var name = sessionID.replace(/0\.[0-9]+$/, '');
  var user = users[name];
  if (user) {
    log.debug('recoverSession: user '+name+' existis');
    user.socket = this;
    this.antUser = user;
    if ( user.sessionID == sessionID ) {
      this.emit('news', 'Your anthill is alive and waiting for your orders.');
      this.emit('anthillDone', sessionID);
    } else recoverFail(this);
  } else recoverFail(this);
}

function recoverFail(socket) {
  socket.emit('news', 'Your last anthill is dead.');
  socket.emit('requestName');
}

function userRequestPlace(data, id) {
  log.info('userRequestPlace', data);
  io.emit('record', record); // update to everybody.
  if ( data.x < 50 ) data.x = 50;
  if ( data.y < 50 ) data.y = 50;
  if ( data.x > gardenW-50 ) data.x = gardenW-50;
  if ( data.y > gardenH-50 ) data.y = gardenH-50;
  if (nearToAnAnthill(data.x, data.y)) {
    data.x += rnd(100)-50;
    data.y += rnd(100)-50;
    return userRequestPlace.bind(this)(data);
  }
  var name = data.name;
  if ( users[name] ) {
    this.emit('news', 'Already exists an anthill named '+name+'.');
    this.emit('requestName');
  } else {
    var user = users[name] = {
      name: name,
      born: now(),
      currentCMD: null,
      cmdTimeout: null,
      food: 500,
      queen: {food: 500},
      anthill: {x:round(data.x), y:round(data.y)},
      pheromone: { pathHome: {}, pathFood: {} },
      proportion: { work:90, warr:10 }
    };
    var r = 140 + rndR(60);
    if (rnd(2)<1) {
      g = rndR(100);
      b = 0;
    } else {
      b = rndR(150);
      g = 0;
    }
    user.color = 'rgb('+r+','+g+','+b+')';
    createAnt(name, 0);
    createAnt(name, 0);
    createAnt(name, 0);
    user.sessionID = id || name + rnd();
    log.debug('User "'+name+'" created');
    if ( this && this.emit ) {
      user.socket = this;
      this.antUser = user;
      this.emit('anthillDone', user.sessionID);
      this.emit('news', 'Your anthill was placed at x:'+
                         user.anthill.x+', y:'+user.anthill.y);
      emitAnthills(io);
    }
  }
}

userRequestPlace({name:'Saúvas',            x:gardenW*.25, y:gardenH*.25}, 1);
userRequestPlace({name:'Tanajuras',         x:gardenW*.75, y:gardenH*.25}, 1);
userRequestPlace({name:'Polyergus lucidus', x:gardenW*.25, y:gardenH*.75}, 1);
userRequestPlace({name:'Myrmecocystus',     x:gardenW*.75, y:gardenH*.75}, 1);
for (i=0; i<10; i++) { dropCandies() };

function countAnts() {
  for ( var name in users ) {
    var user = users[name];
    user.qtd = 0, user.qtdN = 0, user.qtdG = 0;
    user.qWork = 0, user.qWork = 0;
  }
  for ( var id in ants ) {
    var ant = ants[id];
    user = users[ant.owner];
    user.qtd++;
    ( ant.type == 0 )? user.qWork++ : user.qWarr++;
    if ( ant.inside ) { // Nested ants
      user.qtdN++;
      user.newerN = ant;
    } else { // Ants on the grass
      user.qtdG++;
    }
  }
}

function letPheromone(owner, pathType, ant, force) {
  var angle = ant.a+Math.PI;
  if(isNaN(angle)) {
    log.debug('let Fail',ant.id, angle, ant.a);
    angle = 0;
  }
  users[owner].pheromone[pathType][rnd()] = {
    x: ant.x, y: ant.y, vx: cos(angle), vy: sin(angle), force: (force || 400)
  };
}

function nearToGroupElement(entity, group, distance, filter) {
  filter = filter || function(){ return true };
  var nearest = null, smallDistance = distance;
  for ( var id in group ) {
    if ( filter(group[id]) ) {
      var d = dist(group[id].x, group[id].y, entity.x, entity.y);
      if (d < distance && d < smallDistance ) {
        smallDistance = d;
        nearest = group[id];
      }
    }
  }
  return { ent: nearest, dist: smallDistance };
}

function angleTo(p1, p2) {
  var x = p2.x - p1.x;
  var y = p2.y - p1.y;
  var h = Math.sqrt(x*x + y*y);
  if (h==0) {
    return 0;
  } else {
    var acos = Math.acos(x/h);
    var asin = Math.asin(y/h);
    if (isNaN(acos)) {
      log.debug('angleTo fail', p1, p2, x, y, h, 'result:', x/h, '->', acos);
      acos = 0;
    }
    return (asin > 0)? acos : -acos;
  }
}

function attack(ant, force) {
  ant.life -= force;
  if ( ant.life <= 0 ) kill(ant, 'was killed by an enemy.');
}

function kill(ant, msg) {
  msg = ' Your ant "'+ant.id+'", '+msg
  if (users[ant.owner].socket) users[ant.owner].socket.emit('news', msg);
  var candy = candies[ant.candy];
  if (candy) {
    candy.ant = null;
    candy.x = ant.x;
    candy.y = ant.y;
  }
  delete ants[ant.id];
}

function folowPath(ant, pathType) {
  if ( pathType == 'pathFood' ) {
    var candy = nearToGroupElement(ant, candies, 200);
    if ( candy.ent ) {
      ant.a = angleTo(ant, candy.ent);
      return true;
    }
  }
  if ( pathType == 'pathHome' ) {
    var anthill = users[ant.owner].anthill;
    var hillDist = dist(ant.x, ant.y, anthill.x, anthill.y);
    if ( hillDist < 200 ) {
      ant.a = angleTo(ant, anthill);
      if ( hillDist < 5 ) {
        ant.inside = true;
        ant.act = ACTION_FINDFOOD;
        ant.x = anthill.x;
        ant.y = anthill.y;
      }
      return true;
    }
  }
  walkWithoutPath(ant);
  // sv*: pheromones vector sum.
  var svx=0, svy=0, num=0;
  for ( var pheromoneID in users[ant.owner].pheromone[pathType] ) {
    var pheromone = users[ant.owner].pheromone[pathType][pheromoneID];
    if ( dist(ant.x,ant.y, pheromone.x,pheromone.y) < 80 ) {
      num += pheromone.force;
      svx += pheromone.vx * pheromone.force;
      svy += pheromone.vy * pheromone.force;
      if(isNaN(svx)) log.debug('Calc svx fail', ant.id, pheromone.vx, pheromone.force);
    }
  }
  if (num>0) {
    //var acos = Math.acos(svx/num);
    //var asin = Math.asin(svy/num);
    var lastA = ant.a;
    //ant.a = (asin > 0)? acos : -acos;
    ant.a = Math.atan2(svy, svx);
    if(isNaN(ant.a)) {
      log.debug('Calc angle fail', ant.id, 'last Angle:',lastA, 'vecs:',svx,svy,num, 'result:', ant.a);
      ant.a = lastA || 0;
    }
    return true;
  }
  else return false;
}

function setAntDirection(ant) {
  if ( ant.act == ACTION_FINDFOOD ) {
    if ( ant.type == 0 ) { // Workers
      folowPath(ant, 'pathFood');
      var candy = nearToGroupElement(ant, candies, 4);
      if ( candy.ent ) {
          candy.ent.ant = ant.id;
          candy.ent.x = -999;
          ant.candy = candy.ent.id;
          ant.act = ACTION_BACKHOME;
      }
    } else { // Warriors
      if ( nearToGroupElement(ant, candies, 50).ent ) ant.act = ACTION_BACKHOME;
      var enemy = nearToGroupElement(ant, ants, 100,
                  function(ent){ return ent.owner!=ant.owner && !ent.inside });
      if ( enemy.ent ) ant.act = ACTION_FIGHT;
      if (!folowPath(ant, 'pathFood')) {
        var friend = nearToGroupElement(ant, ants, 100,
                     function(ent){ return ent!=ant && ent.owner==ant.owner && !ent.inside });
        if ( friend.ent ) ant.a = angleTo(ant, friend.ent);
      }
    }
  }
  if ( ant.act == ACTION_BACKHOME ) {
    folowPath(ant, 'pathHome');
    if ( ant.type == 0 ) { // Workers
      if(ant.inside && ant.candy) {
        delete candies[ant.candy];
        ant.candy = null;
        users[ant.owner].food += 50;
        ant.act = ACTION_FINDFOOD;
      }
    } else { // Warriors
      var enemy = nearToGroupElement(ant, ants, 100,
                  function(ent){ return ent.owner!=ant.owner && !ent.inside });
      if ( enemy.ent ) ant.act = ACTION_FIGHT;
    }
  }
  if ( ant.act == ACTION_FIGHT ) {
    var enemy = nearToGroupElement(ant, ants, 150,
                function(ent){ return ent.owner!=ant.owner && !ent.inside });
    if ( enemy.ent ) {
      ant.fightAngry = 20; // 10 seconds to forget and back home.
      ant.a = angleTo(ant, enemy.ent);
      if ( enemy.dist < 8 ) attack(enemy.ent, ant.type+1);
    } else {
      walkWithoutPath(ant);
      if ( --ant.fightAngry < 1 ) ant.act = ACTION_BACKHOME;
    }
  }

  // Prevent ant collision
  var otherAnt = nearToGroupElement(ant, ants, 30,
                   function(ent){ return ent!=ant && !ent.inside }).ent;
  // There is a near ant AND ant isnt warrior OR other is a brother
  if ( otherAnt && (ant.type!=1 || otherAnt.owner==ant.owner) ) {
    var angleToOther = angleTo(ant, otherAnt);
    if ( angleToOther-.3<ant.a && angleToOther+.3>ant.a ) { // collision route!
      ( angleToOther < ant.a )? ant.a+=.5 : ant.a-=.5;
    }
  }

  // prevent ant to step over enemy anthill
  var anthill = nearToGroupElement(ant, getAnthills(), 120,
                   function(ah){ return ah.owner!=ant.owner }).ent;
  if (anthill) {
    var angleToAnthill = angleTo(ant, anthill);
    if ( angleToAnthill-.5<ant.a && angleToAnthill+.5>ant.a ) { // collision route!
      ( angleToAnthill < ant.a )? ant.a+=.5 : ant.a-=.5;
    }
  }

  // Cant exit the gardem
  if (ant.x < 0) ant.a = 0;
  if (ant.x > gardenW) ant.a = Math.PI;
  if (ant.y < 0) ant.a = Math.PI*0.5;
  if (ant.y > gardenH) ant.a = Math.PI*1.5;
}

function walkWithoutPath(ant) {
  if (tics%2==0) ant.a += rnd(.8)-.4
}

(function tic() {
  var user;
  tics++;
  if (tics % 100 == 0) dropCandies();
  countAnts();
  // User related updates
  for (var name in users) {
    user = users[name];
    var lifetime = now() - user.born;
    // Feed the queen
    if ( user.queen.food<500 && user.food>0 ) { // Must eat
      user.food--; user.queen.food++;
    }
    var metabolism = 60-round(lifetime/(1000*60));
    if (metabolism<1) metabolism = 1;
    if (tics%1200==0) log.debug('metabolism', user.name, metabolism, lifetime);
    if (tics%metabolism==0) { // consume calories
      user.queen.food--;
      if (user.socket && user.queen.food < 100) user.socket.emit('news', 'Your queen is hungry!');
      if ( user.queen.food < 1 ) gameOver(user, 'Queen died hungry.')
    }
    if (user.socket) user.socket.emit('queenFood', user.queen.food);
    // Ant born
    if (tics%((user.qtd<10)?21:41)==0) createAnt(name);
    // Pop out ants
    if ( (user.qtdG < user.qtdN/2 || user.currentCMD=='getFood' || user.currentCMD=='attack')
         && user.currentCMD!='goHome' ) {
      var ant = user.newerN;
      ant.inside = false;
      ant.x = user.anthill.x;
      ant.y = user.anthill.y;
      ant.a = rnd(6.28);
    }
    if ( user.socket ) {
      user.socket.emit('food', user.food);
      user.socket.emit('lifetime', lifetime);
      if ( lifetime > record.lifetime ) {
        record = {user:name, lifetime:lifetime};
        if (tics%20==0) db('record', record);
        io.emit('record', record);
      }
    }
    // Update pheromone paths
    var pheromone = user.pheromone;
    for (var pathType in pheromone) {
      for ( var pheromoneID in pheromone[pathType] ) {
        var force = --pheromone[pathType][pheromoneID].force;
        if (force<1) delete pheromone[pathType][pheromoneID];
      }
    }
  }
  for ( var id in ants ) {
    var ant = ants[id];
    user = users[ant.owner];
    if (!ant.inside) {
      if (user.currentCMD=='goHome') ant.act = ACTION_BACKHOME;
      if (user.currentCMD=='getFood' && !ant.candy) ant.act = ACTION_FINDFOOD;
      if (user.currentCMD=='attack') {
        ant.act = ACTION_FIGHT;
        ant.fightAngry = 10 + ant.type*5;
        var candy = candies[ant.candy];
        if (candy) { // drop candy
          candy.x = ant.x;
          candy.y = ant.y;
          ant.candy = null;
          candy.ant = null;
        }
      }
      // Select direction to move
      switch (user.currentCMD) {
        case 'goN': ant.a = Math.PI*1.5; break;
        case 'goS': ant.a = Math.PI*.5; break;
        case 'goW': ant.a = Math.PI; break;
        case 'goE': ant.a = 0; break;
        default: setAntDirection(ant);
      }
      // Place pheromone
      var pheromoneType = null;
      if ( ant.act==ACTION_FINDFOOD || ant.act==ACTION_FIGHT ) pheromoneType = 'pathHome';
      if ( ant.act==ACTION_BACKHOME && ant.candy ) pheromoneType = 'pathFood';
      if(pheromoneType && tics%3==0 && !ant.inside) letPheromone(ant.owner, pheromoneType, ant);
      // Move!
      ant.x += cos(ant.a)*8;
      ant.y += sin(ant.a)*8;
    }
    // Feed
    if ( ant.inside && ant.food<500 && user.food>0 ) { // Must eat
      user.food--; ant.food++;
    }
    if (tics%10==0) { // consume calories
      ant.food--;
      if (ant.food<0) kill(ant, 'dies hungry.')
    }
  }
  io.emit('ants', ants);
  io.emit('candies', candies);
  var pheromones={}; for (name in users) pheromones[name] = users[name].pheromone;
  //io.emit('pheromones', pheromones); // DEBUG ONLY
  // Compute TPS (tics per second);
  lastTicTmp = now();
  tps = 1000/(lastTicTmp-lastTic);
  (tps<2)? ticDelay-- : ticDelay++;
  if (ticDelay<10) ticDelay=10;
  lastTic = lastTicTmp;
  setTimeout(tic, ticDelay);
})();

function gameOver(user, msg) {
  for ( var id in ants ) if (ants[id].owner == user.name) kill(ants[id], 'has no queen.');
  delete users[user.name];
  if ( user.socket ) user.socket.emit('gameOver', msg);
  io.emit('news', 'The '+user.name+"'s anthill dies.");
  if ( user.sessionID == 1 )
    userRequestPlace({name:user.name, x:200+rnd(gardenW-400), y:200+rnd(gardenH-400)}, 1);
}
