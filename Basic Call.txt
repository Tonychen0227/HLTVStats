const { HLTV } = require('hltv')
var https = require("https")

const myHLTV = HLTV.createInstance({hltvUrl: 'localhost', loadPage: https.get})

HLTV.getMatches().then((res) => {
  console.log(res)
})