function endGame() {
  // Utility, handle end and cleanup
  alert("Game over!");
  gameScore = 0;
  gameArea.stop();
  drones = [];
  blimp = null;
  startGame();
}

function everyInterval(n) {
  // Utility, for periodic events
  if ((gameArea.frameNo / n) % 1 == 0) {return true;}
  return false;
}

speedCalc = function(speed, impulse, dragCoefficient=0.01) {
  // Apply a mock drag equation to calculate change in volume, dragCoefficient is arbitrary
  if (speed >= 0) {return speed + impulse - (dragCoefficient * speed ** 2);}
  else {return speed + impulse + (dragCoefficient * speed ** 2);}
}

function PhysicsObject2d(x=0, y=0, width=1, height=1, dx=0, dy=0, dragCoefficient=0, ax=0, ay=0) {
  // Generator handling the recording and calculation of physical movements
  this.x = x; this.y = y;
  this.width = width; this.height = height;
  this.dx = dx; this.dy = dy;
  this.dragCoefficient = dragCoefficient;
  this.ax = ax; this.ay = ay;

  this.crashCheck = function(otherPhysics) {
    // Defining own boundaries
    var myleft = this.x;
    var myright = this.x + (this.width);
    var mytop = this.y;
    var mybottom = this.y + (this.height);

    // Defining other boundaries
    var otherleft = otherPhysics.x;
    var otherright = otherPhysics.x + (otherPhysics.width);
    var othertop = otherPhysics.y;
    var otherbottom = otherPhysics.y + (otherPhysics.height);

    // Decide if a collision has occured!
    var crash = true;
    if ((mybottom < othertop) ||
      (mytop > otherbottom) ||
      (myright < otherleft) ||
      (myleft > otherright)) {
        crash = false;
      }
      return crash;
  }

  this.moveCalc = function() {
    // Apply a mock drag equation to calculate change in volume
    // dragCoefficient is arbitrary
    this.dy = speedCalc(this.dy, this.ay, this.dragCoefficient);
    this.y += this.dy;
    this.dx = speedCalc(this.dx, this.ax, this.dragCoefficient);
    this.x += this.dx;

    // Test for impact!
    switch(gameArea.edgeCollisionCheck(this)) {
      case "top":
        this.dy = -this.dy;
        this.y = 1;
        break;
      case "bottom":
        this.dy = -this.dy;
        this.y = gameArea.canvas.height - this.height - 1;
        break;
      case "left":
        this.dx = -this.dx;
        this.x = 1;
        break;
      case "right":
        this.dx = -this.dx;
        this.x = gameArea.canvas.width - this.width - 1;
        break;
    }
  }
}

var gameArea = {
  canvas: document.createElement("canvas"),
  start: function() {
    this.canvas.width = 720;
    this.canvas.height = 540;
    this.canvas.style.cursor = "none";
    this.canvas.style.background = "url('resources/images/sky.png')";
    this.canvas.style.border = "3px solid #73AD21";
    this.context = this.canvas.getContext("2d");

    // Place canvas
    //document.body.insertBefore(this.canvas, document.body.childNodes[2]);
    targetDiv = document.getElementById("game_container");
    targetDiv.appendChild(this.canvas);
    this.frameNo = 0;
    this.interval = setInterval(updateGameArea, 20);

    // Control monitors
    window.addEventListener('keydown', function (e) {
      gameArea.keys = (gameArea.keys || []);
      gameArea.keys[e.keyCode] = true;
    })
    window.addEventListener('keyup', function (e) {
      gameArea.keys[e.keyCode] = false;
    })
  },
  clear : function() {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  },
  stop : function() {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    clearInterval(this.interval);
    gameArea.keys = [];
  },
  edgeCollisionCheck : function(physics) {
    // Utility, test if object has collided with gameArea edge, return which
    if(physics.x <= 0) {
      return "left";
    }
    if((physics.x + physics.width) >= this.canvas.width) {
      return "right";
    }
    if(physics.y <= 0) {
      return "top";
    }
    if((physics.y + physics.height) >= this.canvas.height) {
      return "bottom";
    }
    return null;
  }
}

function Block(color, x, y, width, height) {
  // Generator for obstacles/ground etc
  this.color = color;
  this.physics = new PhysicsObject2d(x, y, width, height);
  this.update = function() {
    ctx = gameArea.context;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.physics.x, this.physics.y, this.physics.width, this.physics.height);
  }
}

function Drone(x, y, changeProb=0.02) {
  // An obstacle/enemy, moves at constant speeds with zero drag
  this.physics = new PhysicsObject2d(x, y, 30, 10, 1, 0, 0, 0, 0);
  this.update = function () {
    // drift up and down in a random walk
    if (Math.random() < changeProb) {
      this.physics.dy = (Math.random() - 0.5) * 4;
    }
    this.physics.moveCalc();
    if (this.physics.crashCheck(blimp.physics)) {
      endGame();
    }
    ctx = gameArea.context;
    ctx.fillStyle = 'black';
    ctx.fillRect(this.physics.x, this.physics.y, this.physics.width, this.physics.height);
  }
}


function Cargo(x, y) {
  // Generator for cargo to collect!
  this.physics = new PhysicsObject2d(x, y, 32, 32);
  this.image = new Image();
  this.image.src = "resources/images/cargo_drop.png";
  this.onGround = true;
  this.update = function () {
    // Test for collision, if yes, update score and move
    if (this.physics.crashCheck(blimp.physics)) {
      this.physics.x = 32 + (Math.random() * (gameArea.canvas.width * 0.9));
      this.physics.y = gameArea.canvas.height - 32 - (Math.random() * 50);
      this.onGround = false;
    }
    if(this.onGround) {
      // Just redraws in place
      ctx = gameArea.context;
      ctx.drawImage(this.image, this.physics.x, this.physics.y, this.physics.width, this.physics.height);
    }
  }
}

function Carrier(x, y) {
  // Generator for the flying carrier you deliver to
  this.physics = new PhysicsObject2d(x, y, 128, 64);
  this.image = new Image();
  this.image.src = "resources/images/carrier_block.png";

  this.update = function() {
    // Check for delivery of cargo
    if (this.physics.crashCheck(blimp.physics)) {
      if (cargo.onGround == false) {
        console.log("has cargo!");
        gameScore += 1;
        console.log(gameScore);
        cargo.onGround = true;
      }
    }
    // Just redraws in place
    ctx.drawImage(this.image, this.physics.x, this.physics.y, this.physics.width, this.physics.height);
    ctx.font = "30px Arial";
    ctx.fillStyle = "white";
    ctx.fillText(gameScore, gameArea.canvas.width - 87, 42);
  }
}


function Blimp(x, y) {
  // Generator for the player's airship!
  this.physics = new PhysicsObject2d(x, y, 64, 32, 0, 0, 0.01, 0, 0);
  this.image = new Image();
  this.image.src = "resources/images/blimp_going_right.png";

  this.update = function() {
    // Update component speed and location
    this.physics.moveCalc();
    // Redraws this component of the game
    ctx = gameArea.context;
    ctx.save();
    // Handles drawing the blimp, translation used to support adding rotation
    // later if I want it.
    ctx.translate(this.physics.x, this.physics.y);
    if (this.physics.dx >= 0) {
      this.image.src = "resources/images/blimp_going_right.png";
    }
    else {
      this.image.src = "resources/images/blimp_going_left.png";
    }
    ctx.drawImage(this.image, 0, 0, this.physics.width, this.physics.height);
    ctx.restore();
  }
}

function updateGameArea() {
  // Wipe clean
  gameArea.clear();
  gameArea.frameNo += 1;
  blimp.physics.ax = 0;
  blimp.physics.ay = 0;

  // Take input
  if (gameArea.keys && gameArea.keys[65]) {blimp.physics.ax = -0.1; }
  if (gameArea.keys && gameArea.keys[68]) {blimp.physics.ax = 0.1; }
  if (gameArea.keys && gameArea.keys[87]) {blimp.physics.ay = -0.05; }
  if (gameArea.keys && gameArea.keys[83]) {blimp.physics.ay = 0.05; }
  areaFloor.update();
  carrier.update();
  blimp.update();
  cargo.update();

  // Drone warfare here
  if (Math.random() < 0.001) {
    drones.push(new Drone(0, Math.random() * (gameArea.canvas.height - 50)));
  }
  for (i=0; i<drones.length; i+=1) {
    drones[i].update();
  }
}

var drones = [];
var gameScore = 0;

function startGame() {
  gameArea.start();
  areaFloor = new Block("green", 0, gameArea.canvas.height - 50, gameArea.canvas.width, 50);
  carrier = new Carrier(gameArea.canvas.width - 128, 0);
  blimp = new Blimp(220, 190);
  cargo = new Cargo(50, gameArea.canvas.height - 50 - 32);
}
