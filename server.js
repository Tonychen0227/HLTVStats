const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const request = require('request');
const argv = require('yargs').argv;

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

let apiKey = '38fe180dfc5e69e3d42d5d7ab51cb58f';
let city = argv.c || 'portland';
let url = `http://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${apiKey}`
    
app.get('/', function (req, res) {
    res.render('index', {weather: null, error: null});
})

app.post('/', function (req, res) {
    request(url, function (err, response, body) {
    if(err){
        res.render('index', {weather: null, error: 'Error, please try again'});
    } else {
        let weather = JSON.parse(body)
        if(weather.main == undefined){
            res.render('index', {weather: null, error: 'Error, please try again'});
        } else {
            let weatherText = `It's ${weather.main.temp} degrees in ${weather.name}!`;
            res.render('index', {weather: weatherText, error: null});
        }
    }
    });
    console.log(req.body.city); 
})
app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
})