const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const { HLTV } = require('hltv');
const https = require("https");
const moment = require("moment");
require('moment-timezone');

var recentUpdates = {};
var recentLogs = {};
var connectedScorebots = [];
var requestedScorebots = [];

var scorebotLock = false;

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
        res.render('landing', {rankings: answer});
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
        match.date = moment(match.date).tz('America/Vancouver').format('Y M-D ha z');
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
    HLTV.getMatch({id: req.query.id}).then(async match => {
        match.date = moment(match.date).tz('America/Vancouver').format('Y M-D ha z');
        if (match.team1 == undefined || match.team2 == undefined) {
            res.render('matchanalysis', {match: null, team1: null, team2: null, team1players: null, team2players: null, averageTeam1: 0, averageTeam2: 0, error: 'Match does not have both teams determined'});
        }
        if (match.headToHead) {
            for (var i = 0; i < match.headToHead.length; i++) {
                if (moment().diff(moment(match.headToHead[i].date), 'days') > 90) {
                    match.headToHead[i].date = moment(match.headToHead[i].date).format('M-D');
                    match.headToHead.splice(i, match.headToHead.length - i)
                    break;
                } else {
                    match.headToHead[i].date = moment(match.headToHead[i].date).format('M-D');
                }
            }
        }
        let team1Promise = undefined;
        let team2Promise = undefined;
        let team1playerPromise = undefined;
        let team2playerPromise = undefined;
        if (match.team1 != undefined && match.team1.id != undefined) {
            team1Promise = new Promise(function(resolve, reject) {
                let output = {};
                console.log('Looking up team ' + match.team1.id);
                HLTV.getTeam({id: match.team1.id}).then(team => {
                    output['name'] = team.name;
                    output['players'] = team.players;
                    output['rank'] = team.rank;
                    output['recentResults'] = team.recentResults;
                    output['mapStatistics'] = team.mapStatistics;
                    resolve(output);
                }).catch(err => {
                    console.log(err);
                    resolve(output);
                })
            })
        }
        if (match.team2 != undefined && match.team2.id != undefined) {
            team2Promise = new Promise(function(resolve, reject) {
                let output = {};
                console.log('Looking up team ' + match.team2.id);
                HLTV.getTeam({id: match.team2.id}).then(team => {
                    output['name'] = team.name;
                    output['players'] = team.players;
                    output['rank'] = team.rank;
                    output['recentResults'] = team.recentResults;
                    output['mapStatistics'] = team.mapStatistics;
                    resolve(output);
                }).catch(err => {
                    console.log(err);
                    resolve(output);
                })
            })
        }
        if (match.players != undefined) {
            team1playerPromise = new Promise(function(resolve, reject) {
                let players = match.players.team1;
                let output = [];
                for (var i = 0; i < players.length; i++) {
                    player = players[i]
                    if (player.id) {
                        let stats = {};
                        HLTV.getPlayerStats({id: player.id}).then(data => {
                            stats['name'] = data.ign;
                            stats['ADR'] = data.statistics.damagePerRound;
                            stats['rating'] = data.statistics.rating;
                            output.push(stats);
                        })
                    } else {
                        output.push(player.name);
                    }
                }
                resolve(output);
            });
            team2playerPromise = new Promise(function(resolve, reject) {
                let players = match.players.team2;
                let output = [];
                for (var i = 0; i < players.length; i++) {
                    player = players[i]
                    if (player.id) {
                        let stats = {};
                        HLTV.getPlayerStats({id: player.id}).then(data => {
                            stats['name'] = data.ign;
                            stats['ADR'] = data.statistics.damagePerRound;
                            stats['rating'] = data.statistics.rating;
                            output.push(stats);
                        })
                    } else {
                        output.push(player.name);
                    }
                }
                resolve(output);
            });
        }
        Promise.all([team1Promise, team2Promise, team1playerPromise, team2playerPromise]).then(function(values) {
            let tempPlayerList = [];
            let averageTeam1 = 0;
            let team1Counter = 0;
            let averageTeam2 = 0;
            let team2Counter = 0;
            for (var i = 0; i < values[2].length; i++) {
                if (values[2][i].rating) {
                    averageTeam1 = averageTeam1 + parseFloat(values[2][i].rating);
                    team1Counter = team1Counter + 1;
                }
                value = values[2][i];
                if (tempPlayerList.length == 0) {
                    tempPlayerList.push(value);
                    continue;
                }
                for (var k = 0; k < tempPlayerList.length; k++) {
                    if (tempPlayerList[k].rating == undefined || value.rating > tempPlayerList[k].rating) {
                        tempPlayerList.splice(k, 0, value);
                        break;
                    }
                    if (k == tempPlayerList.length - 1) {
                        tempPlayerList.push(value);
                        break;
                    }
                }
            }
            values.splice(2, 1, tempPlayerList);
            tempPlayerList = [];
            for (var i = 0; i < values[3].length; i++) {
                if (values[3][i].rating) {
                    averageTeam2 = averageTeam2 + parseFloat(values[3][i].rating);
                    team2Counter = team2Counter + 1;
                }
                value = values[3][i];
                if (tempPlayerList.length == 0) {
                    tempPlayerList.push(value);
                    continue;
                }
                for (var k = 0; k < tempPlayerList.length; k++) {
                    if (tempPlayerList[k].rating == undefined || value.rating > tempPlayerList[k].rating) {
                        tempPlayerList.splice(k, 0, value);
                        break;
                    }
                    if (k == tempPlayerList.length - 1) {
                        tempPlayerList.push(value);
                        break;
                    }
                }
            }
            values.splice(3, 1, tempPlayerList);
            res.render('matchanalysis', {match: match, team1: values[0], team2: values[1], team1players: values[2], team2players: values[3], averageTeam1: (averageTeam1/team1Counter).toFixed(2), averageTeam2: (averageTeam2/team2Counter).toFixed(2), error: null});
        })
    }).catch(err => {
        console.log(err)
        res.render('matchanalysis', {match: null, team1: null, team2: null, team1players: null, team2players: null, averageTeam1: 0, averageTeam2: 0, error: 'An error occurred'});
    })
})

app.post('/matches', function (req, res) {
    if (scorebotLock) {
        console.log('Procedure blocked')
        res.render('matches', {matches: null, error: 'Server difficulties, try again in a few seconds', team: null, event: null});
        return;
    } else {
        console.log('Acquire lock');
        scorebotLock = true;
    }
    console.log('Requesting matches');
    let teamParam = req.body.teamname || "";
    let eventParam = req.body.eventname || "";

    teamParam = teamParam.toUpperCase();
    eventParam = eventParam.toUpperCase();

    HLTV.getMatches().then((answer) => {
        let matches = answer;
        if(matches == undefined){
            console.log('Releasing lock, no matches found')
            scorebotLock = false;
            res.render('matches', {matches: null, error: 'Error, please try again', team: teamParam, event: eventParam});
        } else {
            let output = [];
            for (i = 0; i < matches.length; i++) {
                let team1 = "";
                let team2 = "";
                let event = "";
                matches[i].date = moment(matches[i].date).tz('America/Vancouver').format('Y M-D ha z');
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
                if (matches[i].live && requestedScorebots.indexOf(matchId.toString()) == -1) {
                    console.log(matchId.toString() + " added to requested scorebots")
                    requestedScorebots.push(matchId.toString());
                    HLTV.getMatch({id: matchId}).then(match => {
                        if (match.hasScorebot) {
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
                            console.log(matchId.toString() + " removed from requested scorebots")
                            requestedScorebots.splice(requestedScorebots.indexOf(matchId.toString(), 1));
                        }
                    }).catch(err => {
                        console.log(err);
                    })
                } else if (!matches[i].live) {
                }
            }
            console.log('Releasing lock, done finding matches')
            scorebotLock = false;
            res.render('matches', {matches: matches, error: null, team: teamParam, event: eventParam});
        }
    }).catch(err => {
        console.log('Releasing lock, error finding matches')
        scorebotLock = false;
        res.render('matches', {matches: null, error: 'Error, please try again', team: teamParam, event: eventParam});
        console.log(err);
    });
})

app.get('/results', function (req, res) {
    if (req.query.id == undefined) {
        res.render('results', {match: null, error: 'ID is missing'});
        return;
    }
    console.log('Requesting match ' + req.query.id);
    matchId = req.query.id;
    HLTV.getMatch ({id: matchId}).then(match => {
        match.date = moment(match.date).tz('America/Vancouver').format('Y M-D ha z');
        res.render('results', {result: match, error: null});
    });
})

app.post('/matchresults', function (req, res) {
    let teamParam = req.body.teamname.toUpperCase() || "";
    let pageParam = req.body.pages || 1;
    let eventParam = req.body.eventname.toUpperCase() || "";
    console.log('Requesting match results ' + teamParam + eventParam + pageParam);
    HLTV.getResults({pages: pageParam}).then((answer) => {
        let results = answer
        if(results == undefined){
            res.render('matchresults', {results: null, error: 'Error, please try again', team: teamParam, event: eventParam});
        } else {
            let output = [];
            for (i = 0; i < results.length; i++) {
                let team1 = results[i].team1.name.toUpperCase();
                let team2 = results[i].team2.name.toUpperCase();
                let event = results[i].event.name.toUpperCase();
                results[i].date = moment(results[i].date).tz('America/Vancouver').format('Y M-D ha z');
                console.log(teamParam, eventParam, team1, team2, event);
                if (((team1.indexOf(teamParam) != -1 || 
                team2.indexOf(teamParam) != -1) && teamParam != "")||
                (event.indexOf(eventParam) != -1 && eventParam != "")) {
                    output.push(results[i]);
                }
            }
            if (teamParam != "" || eventParam != "") {
                results = output;
            }
            res.render('matchresults', {results: results, error: null, team: teamParam, event: eventParam});
        }
    }).catch(err => {
        res.render('matchresults', {results: null, error: 'Error, please try again', team: teamParam, event: eventParam});
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