async function loadTexts() {
  const res = await fetch('/texts');
  const texts = await res.json();
  const table = document.getElementById('textsTable');
  table.innerHTML = '';

  texts.forEach(({ id, content, sentiment }) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${id}</td>
      <td>${content}</td>
      <td class="${sentiment || 'UNKNOWN'}">${sentiment || '–'}</td>
      <td><button onclick="analyzeText(${id})">Analyze</button></td>
    `;
    table.appendChild(tr);
  });
}

function authorize() {
  const code = document.getElementById('accessCode').value.trim();
  if (code.toLowerCase() === '12345') {  // ← zmień na swoje 5-literowe hasło
    document.getElementById('loginArea').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    loadTexts();
  } else {
    alert('Invalid access code.');
  }
}

async function analyzeText(id) {
  await fetch(`/analyze/${id}`);
  loadTexts();
}

document.getElementById('addTextForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('newText');
  const text = input.value.trim();
  if (!text) return;

  const detected = 'en'; // zakładamy, że zdanie jest po angielsku
  // const detected = langdetect(text); // poprawka!
  // console.log('Detected language:', detected);
  // if (detected !== 'en') {
  //   alert('Please enter the sentence in English.');
  //   return;
  // }

  const res = await fetch('/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: text })
  });

  const data = await res.json();
  if (res.ok && data.id) {
    await analyzeText(data.id);
    loadTexts();
  } else {
    alert('Failed to add sentence.');
  }

  input.value = '';
});

loadTexts();
