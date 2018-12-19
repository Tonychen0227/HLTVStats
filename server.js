const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const request = require('request');
const argv = require('yargs').argv;
const { HLTV } = require('hltv')
const https = require("https")

var currentUrl;

HLTV.createInstance({hltvUrl: 'localhost', loadPage: https.get})

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.static('images'));
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', function (req, res) {
    console.log('Welcome!');
    currentUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
    var today = new Date();
    var dd = today.getDate();
    var mm = today.getMonth()+1; //January is 0!
    var yyyy = today.getFullYear();
    if(dd<10) {
        dd = '0'+dd
    } 
    if(mm<10) {
        mm = '0'+mm
    } 
    today = yyyy + '-' + mm + '-' + dd;

    var onemonthago = new Date();
    onemonthago.setDate(onemonthago.getDate() - 30);
    var dd = onemonthago.getDate();
    var mm = onemonthago.getMonth()+1;
    var yyyy = onemonthago.getFullYear();
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

app.get('/matches/scorebot', function (req, res) {
    console.log('Connecting to scorebot... ' + req.query.id);
    currentUrl = req.protocol + '://' + req.get('host') + req.originalUrl
    HLTV.getMatch({id: req.query.id}).then(match => {
        if (match.hasScorebot) {
            let recentUpdate;
            let recentLog = [];
            HLTV.connectToScorebot({id: req.query.id, onScoreboardUpdate: (data) => {
                if (currentUrl.indexOf("scorebot") != -1 && currentUrl.indexOf(req.query.id) != -1) {
                    if (!recentUpdate || recentUpdate['money'] == data['money']) {
                        recentUpdate = data;
                        console.log(recentUpdate.currentRound, recentUpdate.counterTerroristScore, recentUpdate.terroristScore);
                    }
                }
            }, onLogUpdate: (data) => { 
                if (currentUrl.indexOf("scorebot") != -1 && currentUrl.indexOf(req.query.id) != -1) {
                    recentLog.push(data.log[0]);
                    if (recentLog.length > 5) {
                        recentLog.shift();
                    }
                    console.log(recentLog);
                } 
            }, onConnect: () => {
                console.log('Scorebot connected' + req.query.id);
            }, onDisconnect: () => {
                console.log('Scorebot disconnected' + req.query.id);
            }})
        } else {
            console.log('Scorebot not found');
            //res.render('scorebot', {match: match, update: null, log: null, error: 'Scorebot not found'});
        }
        res.render('scorebot', {match: match, update: null, log: null, error: 'Scorebot not found'});
    }).catch(err => {
        console.log(err);
    })
    
})

app.get('/matches/matchanalysis', function (req, res) {
    console.log('Requesting analysis for ' + req.query.id);
    currentUrl = req.protocol + '://' + req.get('host') + req.originalUrl
    res.render('matchanalysis', {id: req.query.id, error: null});
})

app.post('/matches', function (req, res) {
    console.log('Requesting matches');
    currentUrl = req.protocol + '://' + req.get('host') + req.originalUrl
    let teamParam = req.body.teamname || "";
    let eventParam = req.body.eventname || "";

    teamParam = teamParam.toUpperCase();
    eventParam = eventParam.toUpperCase();

    HLTV.getMatches().then((answer) => {
        let matches = answer
        if(matches == undefined){
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
            res.render('matches', {matches: matches, error: null, team: teamParam, event: eventParam});
        }
    }).catch(err => {
        res.render('matches', {matches: null, error: 'Error, please try again', team: teamParam, event: eventParam});
        console.log(err)
    });
})

app.post('/results', function (req, res) {
    console.log('Requesting results');
    currentUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
    let teamParam = req.body.teamname || "";
    let daysParam = req.body.days || 1;
    let eventParam = req.body.eventname || "";

    teamParam = teamParam.toUpperCase();
    eventParam = eventParam.toUpperCase();

    var today = new Date();
    var dd = today.getDate() + 1;
    var mm = today.getMonth()+1; //January is 0!
    var yyyy = today.getFullYear();
    if(dd<10) {
        dd = '0'+dd
    } 
    if(mm<10) {
        mm = '0'+mm
    } 
    today = yyyy + '-' + mm + '-' + dd;

    let xdaysago = new Date();
    xdaysago.setDate(xdaysago.getDate() - daysParam);
    var dd = xdaysago.getDate();
    var mm = xdaysago.getMonth()+1;
    var yyyy = xdaysago.getFullYear();
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
    currentUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
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