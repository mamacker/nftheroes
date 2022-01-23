var express = require("express");
var app = express();
let expressWs = require("express-ws")(app);
setupSocket(app);
var https = require("https");
var path = require("path");
var cookieParser = require("cookie-parser");
var session = require("express-session");
var bodyParser = require("body-parser");
let fs = require("fs");
const EventEmitter = require("events");

const Web3 = require("web3");
const Contract = require("web3-eth-contract");
const url =
  "https://eth-mainnet.alchemyapi.io/v2/qOQfSgooV5hjkyhG8JKGlEcLh4f3CaXk";

// Using web3js
const web3 = new Web3(url);

/*
let options = {
  key: fs.readFileSync(
    "/etc/letsencrypt/live/scholar.axie.technology/privkey.pem"
  ),
  cert: fs.readFileSync(
    "/etc/letsencrypt/live/scholar.axie.technology/fullchain.pem"
  ),
};
*/

/*
var server = https.createServer(options, app).listen(3002, function () {
  console.log("Express server listening on port " + 3002);
  expressWs = require("express-ws")(app, server);
  setupSocket(app);
});
*/
const database = "./databases/users.json";
let userdb = null;
try {
  userdb = JSON.parse(fs.readFileSync(database));
} catch (ex) {
  console.log("File probably not there:", ex);
}

function getInput(question, cb) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question(question, (answer) => {
    rl.close();
    cb(answer);
  });
}

app.use(
  session({
    secret: "0xs123##&dfji23nlfnalod932flkmnlfaidsjf9092j34rjlkjfj",
    resave: true,
    saveUninitialized: false,
  })
);

app.use(bodyParser.json());
app.use(cookieParser());
app.use("/static", express.static("static"));
app.use("/.well-known", express.static("static/.well-known"));

app.use(function (req, res, next) {
  req.testing = "testing";
  return next();
});

app.get("/", function (req, res, next) {
  res.redirect("/home");
});

app.get("/home", function (req, res, next) {
  console.log("Home: ", req.session.username);
  res.sendFile(path.join(__dirname, "static") + "/home.html");
});

setInterval(function ping() {
  expressWs.getWss().clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

function sendAll(data) {
  expressWs.getWss().clients.forEach((ws) => {
    if (ws.isAlive) {
      ws.send(JSON.stringify(data));
    }
  });
}

let socketHandlers = {};
function setupSocket(app) {
  app.ws("/", function (ws, req) {
    ws.isAlive = true;
    console.log("Connection established");
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", async function (msg) {
      let data = JSON.parse(msg);
      console.log(msg, data.type);

      socketHandlers[data.type](ws, data);
    });
  });
}

socketHandlers["getgodcount"] = async function (ws, data) {
  let response = JSON.stringify({
    type: "godcount",
    godcount: await getGodCount(data.address),
  });
  ws.send(response);
};

socketHandlers["getgods"] = async function (ws, data) {
  let response = JSON.stringify({
    type: "godsresult",
    gods: await getGods(data.address),
  });
  ws.send(response);
};

const godsAbi = require("./abis/gods.abi.js").default;
const godsAddress = "0x8ccf065f5c4d3e2fcb025329f22222448dbabf8b";
const baseGodUrl =
  "https://ipfs.io/ipfs/QmPtK2cZYj6cqABKDAdtagJ1msAbZ662xgJxkqwD7gLLRT/"; // + ID
async function getGodCount(address) {
  let godsContract = new web3.eth.Contract(godsAbi, godsAddress);
  let godBalance = await godsContract.methods.balanceOf(address).call();
  console.log("God balance:", godBalance);
  return godBalance;
}

async function getGods(address) {
  let godsContract = new web3.eth.Contract(godsAbi, godsAddress);
  let godBalance = await godsContract.methods.balanceOf(address).call();
  console.log("God balance:", godBalance);
  let godsResult = [];
  for (let i = 0; i < godBalance; i++) {
    let getGod = godsContract.methods.tokenOfOwnerByIndex(address, i).call();
    godsResult.push(getGod);
    console.log(getGod);
  }

  return await Promise.all(godsResult);
}

app.listen(5000);

process.on("uncaughtException", function (err) {
  if (err.message == "session not found") {
    console.log("Trezor USB disconnected.");
  } else {
    console.log(err);
  }
});
