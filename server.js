const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const request = require('request');
const argv = require('yargs').argv;
const { HLTV } = require('hltv');
const https = require("https");

var recentUpdates = {};
var recentLogs = {};
var connectedScorebots = [];
var requestedScorebots = [];

var requesting = false;

HLTV.createInstance({hltvUrl: 'localhost', loadPage: https.get});

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.static('images'));
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', function (req, res) { 
    console.log('Welcome!');
    let today = new Date();
    let dd = today.getDate();
    let mm = today.getMonth()+1; //January is 0!
    let yyyy = today.getFullYear();
    if(dd<10) {
        dd = '0'+dd
    } 
    if(mm<10) {
        mm = '0'+mm
    } 
    today = yyyy + '-' + mm + '-' + dd;

    let onemonthago = new Date();
    onemonthago.setDate(onemonthago.getDate() - 30);
    dd = onemonthago.getDate();
    mm = onemonthago.getMonth()+1;
    yyyy = onemonthago.getFullYear();
    if(dd<10) {
        dd = '0'+dd
    } 
    if(mm<10) {
        mm = '0'+mm
    } 
    onemonthago = yyyy + '-' + mm + '-' + dd;
    HLTV.getPlayerRanking({startDate: onemonthago, endDate: today}).then(answer => {
        res.render('landing', {rankings: answer})
    })
})

function scoreboardUpdate(id, data) {
    let recentUpdate = data;
    let history = [];
    let updateCT;
    let updateT;
    for (var i = 0; i < recentUpdate.ctMatchHistory.firstHalf.length; i++) {
        updateCT = recentUpdate.ctMatchHistory.firstHalf[i];
        updateT = recentUpdate.terroristMatchHistory.firstHalf[i];
        if (updateCT.type == "lost") {
            history.push(updateT.type);
        } else {
            history.push(updateCT.type);
        }
    }
    for (var i = 0; i < recentUpdate.ctMatchHistory.secondHalf.length; i++) {
        updateCT = recentUpdate.ctMatchHistory.secondHalf[i];
        updateT = recentUpdate.terroristMatchHistory.secondHalf[i];
        if (updateCT.type == "lost") {
            history.push(updateT.type);
        } else {
            history.push(updateCT.type);
        }
    }
    editedUpdate = {
        'Title': recentUpdate.ctTeamName + " (CT) " + recentUpdate.counterTerroristScore + ' - ' + recentUpdate.terroristScore + " " + (recentUpdate.terroristTeamName || "") + " (T) ",
        'CTs': recentUpdate.CT || "",
        'Ts': recentUpdate.TERRORIST || "",
        'CTName': recentUpdate.ctTeamName || "",
        'TName': recentUpdate.terroristTeamName || "",
        'Map': recentUpdate.mapName || "",
        'ID': id.toString(),
        'RoundHist': history
    }
    if (!recentUpdates[id.toString()]) {
        recentUpdates[id.toString()] = {}
    }
    recentUpdates[id.toString()] = editedUpdate
}

function logUpdate(id, data) {
    let reset = -1
    data = data.log[0];
    if (data.Kill) {
        if (data.Kill.killerSide == 'CT' && data.Kill.victimSide == 'TERRORIST') {
            data = data.Kill.killerNick + " (CT) killed " + data.Kill.victimNick + " (T) with " + data.Kill.weapon;
        } else if (data.Kill.killerSide == 'TERRORIST' && data.Kill.victimSide == 'CT') {
            data = data.Kill.killerNick + " (T) killed " + data.Kill.victimNick + " (CT) with " + data.Kill.weapon;
        } else if (data.Kill.killerSide == 'CT') {
            data = data.Kill.killerNick + " (CT) team killed " + data.Kill.victimNick + " (CT) with " + data.Kill.weapon;
        } else {
            data = data.Kill.killerNick + " (T) team killed " + data.Kill.victimNick + " (T) with " + data.Kill.weapon;
        }
    } else if (data.BombPlanted) {
        data = "Bomb planted (" + data.BombPlanted.tPlayers + " T vs " + data.BombPlanted.ctPlayers + " CT)";
    } else if (data.BombDefused) {
        data = "Bomb has been defused";
    } else if (data.RoundStart) {
        data = "Round started";
    } else if (data.RoundEnd) {
        if (data.RoundEnd.winner == 'CT') {
            data = "Counter-Terrorists win! " + data.RoundEnd.counterTerroristScore + ' CT - ' + data.RoundEnd.terroristScore + ' T';
        } else if (data.RoundEnd.winner == 'TERRORIST') {
            data = "Terrorists win! " + data.RoundEnd.counterTerroristScore + ' CT - ' + data.RoundEnd.terroristScore + ' T';
        }
    } else {
        data = ""
    }
    if (data != "") {
        if (!recentLogs[id.toString()]) {
            recentLogs[id.toString()] = [];
        }
        if (data == "Round started") {
            reset = recentLogs[id.toString()].length;
        }
        recentLogs[id.toString()].push(data);
        if (reset != -1) {
            recentLogs[id.toString()].splice(0, reset);
        }
        if (recentLogs[id.toString()].length > 15) {
            recentLogs[id.toString()] = [];
        }
    }
}

function disconnect(id) {
    if (connectedScorebots.indexOf(id.toString()) != -1) {
        connectedScorebots.splice(connectedScorebots.indexOf(id.toString()), 1);
        delete recentUpdates[id.toString()];
        delete recentLogs[id.toString()];
    }
}

function connect(id) {
    if (connectedScorebots.indexOf(id.toString()) == -1) {
        connectedScorebots.push(id.toString());
    }
}
app.get('/matches/scorebot', function (req, res) {
    console.log('Requesting updated data for ' + req.query.id);
    HLTV.getMatch({id: req.query.id}).then(match => {
        if (connectedScorebots.indexOf(req.query.id) != -1) {
            if (recentUpdates[req.query.id] && recentLogs[req.query.id]) {
                res.render('scorebot', {match: match, update: recentUpdates[req.query.id], log: recentLogs[req.query.id], error: null});
            } else if (recentUpdates[req.query.id]) {
                res.render('scorebot', {match: match, update: recentUpdates[req.query.id], log: null, error: null});
            } else if (recentLogs[req.query.id]) {
                res.render('scorebot', {match: match, update: recentLogs[req.query.id], log: null, error: null});
            } else {
                res.render('scorebot', {match: match, update: null, log: null, error: 'Scorebot not found'});
            }
        } else {
            res.render('scorebot', {match: match, update: null, log: null, error: 'Scorebot not found'});
        }
    })
})

app.get('/matches/matchanalysis', function (req, res) {
    console.log('Requesting analysis for ' + req.query.id);
    res.render('matchanalysis', {id: req.query.id, error: null});
})  

app.post('/matches', function (req, res) {
    if (requesting) {
        res.render('matches', {matches: null, error: 'Please try again later', team: null, event: null});
        return;
    } else {
        requesting = true;
    }
    console.log('Requesting matches');
    let teamParam = req.body.teamname || "";
    let eventParam = req.body.eventname || "";

    teamParam = teamParam.toUpperCase();
    eventParam = eventParam.toUpperCase();

    HLTV.getMatches().then((answer) => {
        let matches = answer;
        if(matches == undefined){
            requesting = false;
            res.render('matches', {matches: null, error: 'Error, please try again', team: teamParam, event: eventParam});
        } else {
            let output = [];
            for (i = 0; i < matches.length; i++) {
                let team1 = "";
                let team2 = "";
                let event = "";
                if (matches[i].team1) {
                    team1 = matches[i].team1.name.toUpperCase() || "";
                }
                if (matches[i].team2) {
                    team2 = matches[i].team2.name.toUpperCase() || "";
                }   
                if (matches[i].event) {
                    event = matches[i].event.name.toUpperCase() || "";
                }
                if (((team1.indexOf(teamParam) != -1 || 
                team2.indexOf(teamParam) != -1) && teamParam != "")||
                (event.indexOf(eventParam) != -1 && eventParam != "")) {
                    output.push(matches[i]);
                }
            }
            if (teamParam != "" || eventParam != "") {
                matches = output;
            }
            for (var i = 0; i < matches.length; i++) {
                let matchId = matches[i].id;
                if (connectedScorebots.indexOf(matchId.toString()) == -1 && requestedScorebots.indexOf(matchId.toString()) != -1) {
                    requestedScorebots.splice(requestedScorebots.indexOf(matchId.toString()), 1);
                }
                if (matches[i].live && requestedScorebots.indexOf(matches[i].id.toString())) {
                    requestedScorebots.push(matchId.toString());
                    setTimeout(() => null, 2000);
                    console.log("Trying to connect scorebot " + matchId)
                    HLTV.connectToScorebot({id: matchId, onScoreboardUpdate: (data) => {
                        scoreboardUpdate(matchId, data);
                    }, onLogUpdate: (data) => { 
                        logUpdate(matchId, data);
                    }, onConnect: () => {
                        console.log('Scorebot connected ' + matchId);
                        connect(matchId);
                    }, onDisconnect: () => {
                        console.log('Scorebot disconnected ' + matchId);
                        disconnect(matchId);
                    }})
                } else {
                    break;
                }
            }
            requesting = false;
            res.render('matches', {matches: matches, error: null, team: teamParam, event: eventParam});
        }
    }).catch(err => {
        requesting = false;
        res.render('matches', {matches: null, error: 'Error, please try again', team: teamParam, event: eventParam});
        console.log(err);
    });
})

app.post('/results', function (req, res) {
    console.log('Requesting results');
    let teamParam = req.body.teamname || "";
    let daysParam = req.body.days || 1;
    let eventParam = req.body.eventname || "";

    teamParam = teamParam.toUpperCase();
    eventParam = eventParam.toUpperCase();

    let today = new Date();
    let dd = today.getDate() + 1;
    let mm = today.getMonth()+1; //January is 0!
    let yyyy = today.getFullYear();
    if(dd<10) {
        dd = '0'+dd
    } 
    if(mm<10) {
        mm = '0'+mm
    } 
    today = yyyy + '-' + mm + '-' + dd;

    let xdaysago = new Date();
    xdaysago.setDate(xdaysago.getDate() - daysParam);
    dd = xdaysago.getDate();
    mm = xdaysago.getMonth()+1;
    yyyy = xdaysago.getFullYear();
    if(dd<10) {
        dd = '0'+dd
    } 
    if(mm<10) {
        mm = '0'+mm
    } 
    xdaysago = yyyy + '-' + mm + '-' + dd;

    HLTV.getMatchesStats({startDate: xdaysago, endDate: today}).then((answer) => {
        console.log(xdaysago, today);
        let results = answer
        if(results == undefined){
            res.render('results', {results: null, error: 'Error, please try again', team: teamParam, event: eventParam});
        } else {
            let output = [];
            for (i = 0; i < results.length; i++) {
                let team1 = results[i].team1.name.toUpperCase();
                let team2 = results[i].team2.name.toUpperCase();
                let event = results[i].event.name.toUpperCase();
                if (((team1.indexOf(teamParam) != -1 || 
                team2.indexOf(teamParam) != -1) && teamParam != "")||
                (event.indexOf(eventParam) != -1 && eventParam != "")) {
                    output.push(results[i]);
                }
            }
            if (teamParam != "" || eventParam != "") {
                results = output;
            }
            res.render('results', {results: results, error: null, team: teamParam, event: eventParam});
        }
    }).catch(err => {
        res.render('results', {results: null, error: 'Error, please try again', team: teamParam, event: eventParam});
        console.log(err)
    });
})

app.get('/results/detailedstats', function (req, res) {
    console.log('Requesting detailed stats for ' + req.query.id);
    HLTV.getMatchMapStats({id: req.query.id}).then((answer) => {
        let results = answer;
        let currentHistory = results.roundHistory;
        let newHistory = [];
        let total_filled = 1;
        for (i = 0; i < currentHistory.length; i++) {
            let pieces = currentHistory[i].score.split("-");
            let sum = parseInt(pieces[0]) + parseInt(pieces[1]);
            for (k = sum; k > i + total_filled; k--) {
                newHistory.push({outcome: "time_out", score: (parseInt(pieces[0]) - 1).toString() + "-" + pieces[1]});
                pieces[0] = (parseInt(pieces[0]) - 1).toString();
                total_filled = total_filled + 1;
            }
            newHistory.push(currentHistory[i]);
        }
        if (!newHistory[newHistory.length - 1].score.split("-").includes("16")) {
            pieces = newHistory[newHistory.length - 1].score.split("-");
            let target = parseInt(pieces[0])
            for (i = target; i < 16; i++) {
                newHistory.push({outcome: "time_out", score: (parseInt(pieces[0]) + 1).toString() + "-" + pieces[1]});
            }
        }
        if (newHistory.length > 30) {
            newHistory.splice(30, newHistory.length - 30);
        }
        results.roundHistory = newHistory;
        if(results == undefined){
            res.render('detailedstats', {results: null, error: 'Error, please try again'});
        } else {
            res.render('detailedstats', {results: results, error: null});
        }
    }).catch(err => {
        res.render('detailedstats', {results: null, error: 'Error, please try again'});
        console.log(err)
    });
})

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Our app is running on port ${ PORT }`);
});