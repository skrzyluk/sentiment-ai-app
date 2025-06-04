async function loadTexts() {
  const res = await fetch('/texts');
  const texts = await res.json();
  const table = document.getElementById('textsTable');
  table.innerHTML = '';

  texts.forEach(({ id, content, sentiment }) => {
    const tr = document.createElement('tr');

    const tdId = document.createElement('td');
    tdId.textContent = id;
    tr.appendChild(tdId);

    const tdContent = document.createElement('td');
    tdContent.textContent = content;
    tr.appendChild(tdContent);

    const tdSentiment = document.createElement('td');
    tdSentiment.className = sentiment || 'UNKNOWN';
    tdSentiment.textContent = sentiment || '–';
    tr.appendChild(tdSentiment);

    const tdAction = document.createElement('td');
    const button = document.createElement('button');
    button.textContent = 'Analyze';
    button.addEventListener('click', () => analyzeText(id));
    tdAction.appendChild(button);
    tr.appendChild(tdAction);

    table.appendChild(tr);
  });
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

  const detected = langdetect(text);
  console.log('Detected language:', detected);
  if (detected !== 'en') {
    alert('Please enter the sentence in English.');
    return;
  }

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
