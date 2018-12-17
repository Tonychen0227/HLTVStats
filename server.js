const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const request = require('request');
const argv = require('yargs').argv;
const { HLTV } = require('hltv')
const https = require("https")

HLTV.createInstance({hltvUrl: 'localhost', loadPage: https.get})

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.static('images'));
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', function (req, res) {
    res.render('landing');
})

app.get('/matches/scorebot', function (req, res) {
    HLTV.getMatch({id: req.query.id}).then(res => {
        let match = res
        res.render('scorebot', {match: match, error: null})
    }).catch(err => {
        res.render('scorebot', {match: null, error: 'Error, please try again'})
    })
    /*
    HLTV.connectToScorebot({id: req.query.id, onScoreboardUpdate: (data) => {

    }, onLogUpdate: (data) => {

    }
    */
})

app.get('/matches/matchanalysis', function (req, res) {
    res.render('matchanalysis', {id: req.query.id, error: null});
})

app.get('/matches', function (req, res) {
    HLTV.getMatches().then((answer) => {
        let matches = answer
        if(matches == undefined){
            res.render('matches', {matches: null, error: 'Error, please try again'});
        } else {
            res.render('matches', {matches: matches, error: null});
        }
    }).catch(err => {
        res.render('matches', {matches: null, error: 'Error, please try again'});
        console.log(err)
    });
})

app.get('/results', function (req, res) {
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

    var onedayago = new Date();
    onedayago.setDate(onedayago.getDate() - 1);
    var dd = onedayago.getDate();
    var mm = onedayago.getMonth()+1;
    var yyyy = onedayago.getFullYear();
    if(dd<10) {
        dd = '0'+dd
    } 
    if(mm<10) {
        mm = '0'+mm
    } 
    onedayago = yyyy + '-' + mm + '-' + dd;

    HLTV.getMatchesStats({startDate: onedayago, endDate: today}).then((answer) => {
        let results = answer
        if(results == undefined){
            res.render('results', {results: null, error: 'Error, please try again'});
        } else {
            res.render('results', {results: results, error: null});
        }
    }).catch(err => {
        res.render('results', {results: null, error: 'Error, please try again'});
        console.log(err)
    });
})

app.post('/results', function (req, res) {
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

    var xdaysago = new Date();
    xdaysago.setDate(xdaysago.getDate() - req.body.days);
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
        let results = answer
        if(results == undefined){
            res.render('results', {results: null, error: 'Error, please try again'});
        } else {
            res.render('results', {results: results, error: null});
        }
    }).catch(err => {
        res.render('results', {results: null, error: 'Error, please try again'});
        console.log(err)
    });
})

app.get('/results/detailedstats', function (req, res) {
    HLTV.getMatchMapStats({id: req.query.id}).then((answer) => {
        let results = answer;
        let currentHistory = results.roundHistory;
        let newHistory = [];
        let total_filled = 1;
        for (i = 0; i < currentHistory.length; i++) {
            let pieces = currentHistory[i].score.split("-");
            let sum = parseInt(pieces[0]) + parseInt(pieces[1]);
            console.log(sum, i + 1, pieces)
            for (k = sum; k > i + total_filled; k--) {
                newHistory.push({outcome: "time_out", score: (parseInt(pieces[0]) - 1).toString() + "-" + pieces[1]});
                pieces[0] = (parseInt(pieces[0]) - 1).toString();
                total_filled = total_filled + 1;
            }
            newHistory.push(currentHistory[i]);
        }
        console.log(newHistory);
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