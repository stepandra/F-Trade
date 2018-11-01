const Telegraf = require('telegraf');
const WizardScene = require('telegraf/scenes/wizard');
const session = require('telegraf/session');
const Markup = require('telegraf/markup');
// const Extra = require('telegraf/extra');

const Stage = require('telegraf/stage');

// const Composer = require('telegraf/composer');
const ccxt = require('ccxt');
const log = require('ololog');
const keys = require('./keys.json');
const asTable = require('as-table').configure({
  delimiter: ' | ',
});


const bot = new Telegraf(keys.botSecret);
const accounts = [];


const menuButton = (ctx) => {
  ctx.reply('Выбирите действие.', Markup.inlineKeyboard([[
    Markup.callbackButton('Balance 💰', 'showBalance'),
    Markup.callbackButton('Active trades 📊', 'activePositions'),
  ],
  [
    Markup.callbackButton('New trade 🛎', 'openPosition'),
    Markup.callbackButton('Claim position 📊', 'closeMarket'),
  ]])
      .resize()
      .extra());
};
const position = {
  type: '',
  name: '',
  amount: '',
  in: '',
  sl: '',
};

// const closeMarket = new WizardScene(
// "closeMarket",
// (ctx) => {
//   (async () => {
//
//   })()
// }
// );
const openPosition = new WizardScene(
    'openPosition',
    (ctx) => {
      ctx.reply('Order type: ', Markup.inlineKeyboard([
        Markup.callbackButton('LONG 📈', 'buy'),
        Markup.callbackButton('SHORT 📉', 'sell'),
      ]).extra());
      return ctx.wizard.next();
    },
    (ctx) => {
      position.type = ctx.callbackQuery.data;
      ctx.reply('Asset name: ');
      return ctx.wizard.next();
    },
    (ctx) => {
      position.name = ctx.message.text.toUpperCase() + '/USDT';
      ctx.reply('Volume in %: ');
      return ctx.wizard.next();
    },
    (ctx) => {
      position.amount = parseInt(ctx.message.text);
      ctx.reply('IN: ');
      return ctx.wizard.next();
    },
    (ctx) => {
      position.in = parseFloat(ctx.message.text);
      ctx.reply('Stop-loss: ');
      return ctx.wizard.next();
    },
    (ctx) => {
      (async () => {
        try {
          position.sl = parseFloat(ctx.message.text);
          for (let i = 0; i < accounts.length; i++) {
            const marginInfo = await accounts[i].privatePostMarginInfos();
            const marginBalance = marginInfo[0].margin_balance*3.3*0.01;
            const orderSize = ((marginBalance*position.amount)/position.in);
            log(orderSize);
            const orderID = await accounts[i].createOrder(position.name,
                'limit', position.type, orderSize.toFixed(0), position.in, {
                  'type': 'limit',
                });
            console.log(orderID.info.id);
            const checkOrder = await accounts[i].fetchOrder(orderID.info.id);
            log(checkOrder);
            if (checkOrder.status === 'open') {
              const type = position.type === 'buy' ? 'sell' : 'buy';
              const stopID = await accounts[i].createOrder(position.name,
                  'stop', type, orderSize.toFixed(0), position.sl, {
                    'type': 'stop',
                  });
              console.log(stopID.info.id);
              const openOrders = await accounts[i].fetchOpenOrders(position.name);
              ctx.reply(asTable(openOrders.map((item) => {
                return {
                  type: item.type,
                  side: item.side,
                  price: item.price,
                  amount: item.amount,
                };
              })));
            }
          }
        } catch (e) {
          console.log(e);
          ctx.reply(e);
        }
        log(position);

        position.type = '';
        position.name = '';
        position.amount = '';
        position.in = '';
        position.sl = '';
        return ctx.wizard.next();
      })();
    },
    (ctx) => {
      ctx.reply('Done! ');
      return ctx.scene.leave();
    }
);
const activePositions = new WizardScene('activePositions',
    (ctx) => {
      (async () => {
        try {
          const positions = [];
          for (let i = 0; i < accounts.length; i++) {
            positions.push(await accounts[i].privatePostPositions());
            console.log(positions);
            const filtered = positions[i].map((item) => {
              return {
                symbol: item.symbol.toUpperCase(),
                base: parseInt(item.base).toFixed(4),
                amount: parseInt(item.amount).toFixed(0),
                pl: parseInt(item.pl).toFixed(2) + ' $',
              };
            });

            ctx.reply(` *${keys.accounts[i].name.toUpperCase()}* \n
            *${asTable(filtered)}* `);
          }
        } catch (e) {
          log(e);
          ctx.reply(e);
        }
        menuButton(ctx);

        return ctx.scene.leave();
      })();
    });

const showBalance = new WizardScene(
    'showBalance',
    (ctx) => {
      (async () => {
        try {
          for (let i = 0; i < accounts.length; i++) {
            const balance = await accounts[i].fetchBalance({
              type: 'margin',
            });
            const marginInfo = await accounts[i].privatePostMarginInfos();
            const marginBalance = marginInfo[0].margin_balance;
            // console.log(marginBalance);

            const filtredBalance = balance.info.filter(
                (name) => name.type === 'trading' && name.amount > 0);
            const tableView = asTable(filtredBalance.map((item) => {
              const available = item.currency !== 'usd' ?
              (parseInt(marginBalance)*parseInt(item.available)
              /parseInt(item.amount)).toFixed(2) :
              parseInt(item.available).toFixed(2);
              const avPercent = (available/parseInt(marginBalance))*100;
              return {
                coin: item.currency.toUpperCase(),
                amount: parseInt(item.amount).toFixed(2),
                available: available + ' $',
                percent: avPercent.toFixed(1) + ' %',
                total: parseInt(marginBalance).toFixed(2) + ' $',
              };
            }));
            ctx.replyWithMarkdown(`*${keys.accounts[i].name.toUpperCase()}* \n
              *${tableView}* `);
          }
          menuButton(ctx);

          // ctx.reply('Balance');
          return ctx.scene.leave();
        } catch (e) {
          log(e);
          ctx.reply(e);
        }
      })();
    });

const stage = new Stage([showBalance, activePositions, openPosition]);

bot.use(session());
bot.use(stage.middleware());


bot.action('showBalance', (ctx) => ctx.scene.enter('showBalance'));
bot.action('activePositions', (ctx) => ctx.scene.enter('activePositions'));
bot.action('openPosition', (ctx) => ctx.scene.enter('openPosition'));

stage.register(showBalance);
stage.register(activePositions);
stage.register(openPosition);
// bot.hears('New trade 🛎', (ctx) => ctx.scene.enter('openPosition'));
// bot.action('closeMarket', (ctx) => enter('closeMarket'));

for (let i = 0; i < keys.accounts.length; i++) {
  const bitfinex = new ccxt.bitfinex({
    'apiKey': keys.accounts[i].apiKey,
    'secret': keys.accounts[i].secretKey,
  });
  accounts.push(bitfinex);
}

bot.start((ctx) => {
  menuButton(ctx);
});

bot.command('marketsell', (ctx) => {
  (async () => {
    params = {
      'type': 'market',
    };
    const res = await bitfinex.createMarketSellOrder('XRP/USDT', '40', {
      'type': 'market',
    });
    console.log(res);
    ctx.reply(res);
  })();
});
bot.startPolling();
