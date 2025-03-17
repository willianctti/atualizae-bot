import express from 'express';
import { TwitterApi } from 'twitter-api-v2';
import schedule from 'node-schedule';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const postedNewsIds = new Set();

async function fetchNews() {
  try {
    const apiKey = process.env.NEWS_API_KEY || 'pub_7494649ebfcc403e9424489113552c4910907';
    const response = await axios.get(`https://newsdata.io/api/1/latest?country=br&apikey=${apiKey}`);

    if (response.data.status === 'success' && response.data.results.length > 0) {
      const unpostedNews = response.data.results.filter(
        news => !postedNewsIds.has(news.article_id)
      );

      if (unpostedNews.length > 0) {
        const newsItem = unpostedNews[0];
        
        postedNewsIds.add(newsItem.article_id);
        
        if (postedNewsIds.size > 1000) {
          const tempArray = Array.from(postedNewsIds);
          postedNewsIds.clear();
          tempArray.slice(500).forEach(id => postedNewsIds.add(id));
        }
        
        return newsItem;
      }
    }
    
    console.log('Nenhuma notícia nova disponível');
    return null;
  } catch (error) {
    console.error('Erro ao buscar notícias:', error.message);
    if (error.response) {
      console.error('Detalhes do erro:', error.response.data);
    }
    return null;
  }
}

async function postNewsTweet() {
  console.log('Iniciando tentativa de postagem de tweet...');
  const client = new TwitterApi({
    appKey: process.env.CONSUMER_KEY,
    appSecret: process.env.CONSUMER_SECRET,
    accessToken: process.env.ACCESS_TOKEN,
    accessSecret: process.env.ACCESS_TOKEN_SECRET,
  });

  try {
    const newsItem = await fetchNews();
    
    if (!newsItem) {
      console.log('Nenhuma notícia disponível para postar');
      return;
    }
    
    let description = newsItem.description || newsItem.title;
    if (description.length > 200) {
      description = description.substring(0, 197) + '...';
    }
    
    const tweetContent = `${description}\n\n${newsItem.link}`;
    console.log('Tentando postar tweet:', tweetContent);
    
    const tweet = await client.v2.tweet(tweetContent);
    console.log('Tweet postado com sucesso:', tweet);
  } catch (error) {
    console.error('Erro ao postar tweet:', error);
    if (error.response) {
      console.error('Detalhes da resposta:', error.response.data);
    }
  }
}

app.get('/', (req, res) => {
  res.send('Bot está rodando!');
});

app.get('/healthcheck', (req, res) => {
  res.send('OK');
});

// Função para fazer self-ping
async function keepAlive() {
  try {
    const url = 'https://atualizae-bot.onrender.com/';
    await axios.get(`${url}/healthcheck`);
    console.log('Self-ping executado com sucesso');
  } catch (error) {
    console.error('Erro no self-ping:', error.message);
  }
}

schedule.scheduleJob('*/4 * * * *', keepAlive);

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});

const job = schedule.scheduleJob('*/5 * * * *', postNewsTweet);
postNewsTweet();