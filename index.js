import { TwitterApi } from 'twitter-api-v2';
import schedule from 'node-schedule';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

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
    
    const tweet = await client.v2.tweet(tweetContent);
  } catch (error) {
    console.error('Erro ao postar tweet:', error);
  }
}

const job = schedule.scheduleJob('*/10 * * * *', postNewsTweet);

postNewsTweet();