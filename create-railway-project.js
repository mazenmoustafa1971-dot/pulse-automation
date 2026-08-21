const axios = require('axios');

const API_KEY = 'b69de1fa-16b2-4fd0-928d-acdf52513d9d';
const query = `
  mutation {
    projectCreate(input: {name: "PULSE - WhatsApp Orders"}) {
      project {
        id
        name
        createdAt
      }
    }
  }
`;

axios.post('https://api.railway.app/graphql', { query }, {
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  },
})
  .then(r => console.log(JSON.stringify(r.data, null, 2)))
  .catch(err => console.error('Error:', err.response?.data || err.message));
