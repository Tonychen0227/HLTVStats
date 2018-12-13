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
    console.log("requested matches"); 
})

app.get('/results', function (req, res) {
    HLTV.getMatchesStats({startDate: '2018-12-11', endDate: '2018-12-12'}).then((answer) => {
        let matches = answer
        if(matches == undefined){
            res.render('results', {matches: null, error: 'Error, please try again'});
        } else {
            res.render('results', {matches: matches, error: null});
        }
    }).catch(err => {
        res.render('results', {matches: null, error: 'Error, please try again'});
        console.log(err)
    });
    console.log("requested matches"); 
})

app.get('/results/detailedstats', function (req, res) {
    res.render('detailedstats', {id: req.query.id, error: null});
})

app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
})