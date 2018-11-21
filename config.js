

const keys = {
  botSecret: global.env.BOT_SECRET,
  accounts: [{
    name: 'ALEX_DP',
    apiKey: global.env.ALEX_DP_API,
    secretKey: global.env.ALEX_DP_SECRET,
  }, {
    name: 'DUKKER',
    apiKey: global.env.DUKKER_API,
    secretKey: global.env.DUKKER_SECRET,
  }, {
    name: 'MAZALISHE',
    apiKey: global.env.MAZALISHE_API,
    secretKey: global.env.MAZALISHE_SECRET,
  },
  {
    name: 'ALEX_TEX',
    apiKey: global.env.ALEXTEX_API,
    secretKey: global.env.ALEXTEX_SECRET,
  }],
};

module.exports = keys;
