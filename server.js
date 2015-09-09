'use strict';

var gardenW = 5000,
    gardenH = 5000,
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
    record = db('record') || {user:'nobody', lifetime:0};
    io = require('sandbox-io');

io.on('connection', function(socket) {
  log.debug('New connection', socket.id);
  socket.emit('news', 'Connected!');
  emitAnthills(socket);
  socket.on('requestPlace', userRequestPlace);
  socket.on('recoverSession', recoverSession);
  socket.on('proportion', updateProportion);
});

function updateProportion(data) {
  log.debug('Proportion Update', this.antUser.name, data);
  if (this.antUser) this.antUser.proportion = data;
}

function emitAnthills(socket) {
  var anthills = {};
  for (var name in users) anthills[name] = {
    owner: name,
    x: users[name].anthill.x,
    y: users[name].anthill.y,
    color: users[name].color
  };
  socket.emit('anthills', anthills);
}

var antNames = 'And Ami Cly Ceu Den Dim Fye Fin Gio Guu Mia Zee Zed'.split(' ');
function createAnt(userName, type) {
  var owner = users[userName];
  var id = antNames[rndR(antNames.length-1)] +' '+ ++lastAntNum;
  if (!type) type = (owner.proportion.work < (owner.qWork / owner.qtd)*100)? 1 : 0;
  ants[id] = {
    id: id,
    x: -99,
    y: -99,
    a: rnd(6.28),
    life: (type==0)? 20 : 40,
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
    if ( dist(x,y, anthill.x,anthill.y) < 150 ) return true;
  }
  return false;
}

function dropCandies() {
  var x = gardenW*.3 + rnd(gardenW*.4);
  var y = gardenH*.3 + rnd(gardenH*.4);
  while (nearToAnAnthill(x,y)) {
    x = gardenW*.1 + rnd(gardenW*.8);
    y = gardenH*.1 + rnd(gardenH*.8);
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
    log.debug('recoverSession: user '+name+' existis')
    user.socket = this;
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

function userRequestPlace(data) {
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
      anthill: {x:round(data.x), y:round(data.y), food:100},
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
    user.sessionID = name + rnd();
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

userRequestPlace({name:'Saúvas', x:2100, y:2100});
userRequestPlace({name:'Tanajuras', x:2900, y:2100});
userRequestPlace({name:'Polyergus lucidus', x:2100, y:2500});
userRequestPlace({name:'Myrmecocystus', x:2900, y:2500});
for (i=0; i<10; i++) { dropCandies() };

function countAnts() {
  for ( var name in users ) {
    var user = users[name];
    user.qtd = 0, user.qtdN = 0, user.qtdG = 0;
    user.qWork = 0, user.qWork = 0;
    //user.qWorkN = 0, user.qWorkG = 0;
    //user.qWarrN = 0, user.qWarrG = 0;
  }
  for ( var id in ants ) {
    var ant = ants[id];
    user = users[ant.owner];
    user.qtd++;
    ( ant.type == 0 )? user.qWork++ : user.qWarr++;
    if ( ant.inside ) { // Nested ants
      user.qtdN++;
      user.newerN = ant;
//      if ( ant.type == 0 ) {
//        user.newerWorkerN = ant;
//        user.qWorkN++;
//      } else {
//        user.qWarrN++
//      }
    } else { // Ants on the grass
      user.qtdG++;
//      ( ant.type == 0 )? user.qWorkG++ : user.qWarrG++;
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
    x: ant.x, y: ant.y, vx: cos(angle), vy: sin(angle), force: (force || 300)
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
  if ( ant.life <= 0 ) kill(ant, ant.id+' was killed by an enemy.');
}

function kill(ant, msg) {
  if (users[ant.owner].socket) users[ant.owner].socket.emit('news', msg);
  delete ants[ant.id];
}

function folowPath(ant, pathType) {
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
    var acos = Math.acos(svx/num);
    var asin = Math.asin(svy/num);
    var lastA = ant.a;
    ant.a = (asin > 0)? acos : -acos;
    if(!ant.a) {
      log.debug('Calc angle fail', ant.id, 'last Angle:',lastA, 'vecs:',svx,svy,num, 'result:', ant.a);
      ant.a = lastA || 0;
    }
    return true;
  }
  else return false;
}

function moveAnt(ant) {
  var pheromoneType = 'pathHome';
  if ( ant.act == ACTION_FINDFOOD ) {
    if ( ant.type == 0 ) { // Workers
      var candy = nearToGroupElement(ant, candies, 200);
      if ( candy.ent ) {
        ant.a = angleTo(ant, candy.ent);
        if ( candy.dist < 4 ) {
          candy.ent.ant = ant.id;
          candy.ent.x = -999;
          ant.candy = candy.ent.id;
          ant.act = ACTION_BACKHOME;
        }
      } else folowPath(ant, 'pathFood');
    } else { // Warriors
      if ( nearToGroupElement(ant, candies, 20).ent ) ant.act = ACTION_BACKHOME;
      var enemy = nearToGroupElement(ant, ants, 100,
                  function(ent){ return ent.owner!=ant.owner && !ent.inside });
      if ( enemy.ent ) {
        ant.a = angleTo(ant, enemy.ent);
        if ( enemy.dist < 4 ) attack(enemy.ent, 2);
      } else if (!folowPath(ant, 'pathFood')) {
        var friend = nearToGroupElement(ant, ants, 100,
                     function(ent){ return ent.owner==ant.owner && !ent.inside });
        if ( friend.ent ) ant.a = angleTo(ant, friend.ent);
      }
    }
  }
  if ( ant.act == ACTION_BACKHOME ) {
    var anthill = users[ant.owner].anthill;
    var hillDist = dist(ant.x, ant.y, anthill.x, anthill.y);
    if ( ant.type == 0 ) { // Workers
      if ( hillDist < 200 ) {
        ant.a = angleTo(ant, anthill);
        if ( hillDist < 4 ) {
          ant.inside = true;
          if(ant.candy) {
            delete candies[ant.candy];
            ant.candy = null;
            users[ant.owner].anthill.food += 10;
            ant.act = ACTION_FINDFOOD;
          }
        }
      } else folowPath(ant, 'pathHome');
    } else { // Warriors
      var enemy = nearToGroupElement(ant, ants, 100,
                  function(ent){ return ent.owner!=ant.owner && !ent.inside });
      if ( enemy.ent ) ant.act = ACTION_FIGHT;
      if ( hillDist < 200 ) {
        ant.a = angleTo(ant, anthill);
        if ( hillDist < 4 ) ant.inside = true;
      } else folowPath(ant, 'pathHome');
    }
    pheromoneType = 'pathFood';
  }
  if ( ant.act == ACTION_FIGHT ) {
    var enemy = nearToGroupElement(ant, ants, 150,
                function(ent){ return ent.owner!=ant.owner && !ent.inside });
    if ( enemy.ent ) {
      ant.fightAngry = 40; // 20 seconds to forget and back home.
      ant.a = angleTo(ant, enemy.ent);
      if ( enemy.dist < 8 ) attack(enemy.ent, 2);
    } else {
      walkWithoutPath(ant);
      if ( --ant.fightAngry < 1 ) ant.act == ACTION_BACKHOME;
    }
  }
  if(tics%3==0) letPheromone(ant.owner, pheromoneType, ant);
  ant.x += cos(ant.a)*8;
  ant.y += sin(ant.a)*8;
}

function walkWithoutPath(ant) {
  if (tics%2==0) ant.a += rnd(.8)-.4
}

(function tic() {
  tics++;
  if (tics % 100 == 0) dropCandies();
  countAnts();
  // User related updates
  for (var name in users) {
    var user = users[name];
    // Ant born
    if (tics%101==0) createAnt(name);
    // Pop out ants
    if ( user.qtdG < user.qtdN/2 ) {
      var ant = user.newerN;
      ant.inside = false;
      ant.x = user.anthill.x;
      ant.y = user.anthill.y;
      ant.a = rnd(6.28);
    }
    if ( user.socket ) {
      user.socket.emit('food', user.anthill.food);
      var lifetime = now() - user.born;
      user.socket.emit('lifetime', lifetime);
      if ( lifetime > record.lifetime || name != record.user ) {
        record = {user:name, lifetime:lifetime};
        if (tics%10==0) db('record', record);
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
  for ( var id in ants ) if (!ants[id].inside) moveAnt(ants[id]);
  io.emit('ants', ants);
  io.emit('candies', candies);
  var pheromones={}; for (name in users) pheromones[name] = users[name].pheromone;
  io.emit('pheromones', pheromones); // DEBUG ONLY
  // Compute TPS (tics per second);
  lastTicTmp = now();
  tps = 1000/(lastTicTmp-lastTic);
  (tps<2)? ticDelay-- : ticDelay++;
  if (ticDelay<10) ticDelay=10;
  lastTic = lastTicTmp;
  setTimeout(tic, ticDelay);
})();

