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
    res.render('HLTVMain', {matches: null, error: null});
})

app.post('/', function (req, res) {

    HLTV.getMatches().then((answer) => {
        let matches = answer
        if(matches == undefined){
            res.render('HLTVMain', {matches: null, error: 'Error, please try again'});
        } else {
            res.render('HLTVMain', {matches: matches, error: null});
        }
    }).catch(err => {
        res.render('HLTVMain', {matches: null, error: 'Error, please try again'});
        console.log(err)
    });
    console.log("requested matches"); 
})

app.listen(3001, function () {
  console.log('Example app listening on port 3000!');
})