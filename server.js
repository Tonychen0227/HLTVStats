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
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', function (req, res) {
    res.render('landing');
})

app.get('/matches/scorebot', function (req, res) {
    res.render('scorebot', {id: req.query.id, error: null});
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
        let results = answer
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