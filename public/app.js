const chat = document.getElementById('chat');
const messageInput = document.getElementById('message');
const sendBtn = document.getElementById('send');
const imageInput = document.getElementById('imageInput');
const previewBar = document.getElementById('previewBar');
const previewImg = document.getElementById('previewImg');
const removeImg = document.getElementById('removeImg');
const modelSelect = document.getElementById('model');

let selectedImage = null;
let currentSessionId = null;
let isSending = false;

// ---- Image upload ----
imageInput.addEventListener('change', async () => {
  const file = imageInput.files[0];
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) {
    alert('Image 8MB se choti honi chahiye');
    return;
  }
  const base64 = await toBase64(file);
  selectedImage = { base64, mime: file.type, dataUrl: URL.createObjectURL(file) };
  previewImg.src = selectedImage.dataUrl;
  previewBar.classList.remove('hidden');
});

removeImg.addEventListener('click', () => {
  selectedImage = null;
  imageInput.value = '';
  previewBar.classList.add('hidden');
});

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// ---- Add msg ----
function addMsg(text, who, imgUrl = null, extraClass = '') {
  const div = document.createElement('div');
  div.className = `msg ${who} ${extraClass}`.trim();
  div.textContent = text;
  if (imgUrl) {
    const img = document.createElement('img');
    img.src = imgUrl;
    div.appendChild(img);
  }
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div;
}

function addCodeMsg(code) {
  const div = document.createElement('div');
  div.className = 'msg bot';
  const pre = document.createElement('pre');
  pre.textContent = code;
  div.appendChild(pre);
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div;
}

// ---- Send ----
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

async function sendMessage() {
  if (isSending) return;
  const text = messageInput.value.trim();
  const model = modelSelect.value;
  const isImageEdit = model === 'imageedit';
  const isImageGen = model === 'imagegen';

  if (!text && !selectedImage) return;
  if (isImageEdit && !selectedImage) {
    alert('Image Edit ke liye image upload karein');
    return;
  }
  if (isImageEdit && !text) {
    alert('Edit prompt likhein (e.g. "make it blue")');
    return;
  }
  if (isImageGen && !text) {
    alert('Image generate karne ke liye prompt likhein (e.g. "cute cat")');
    return;
  }

  isSending = true;
  sendBtn.disabled = true;

  addMsg(text || '[image]', 'user', selectedImage ? selectedImage.dataUrl : null);

  const payloadText = text;
  const payloadImage = selectedImage;
  messageInput.value = '';
  selectedImage = null;
  imageInput.value = '';
  previewBar.classList.add('hidden');

  const loadingMsg = addMsg('⏳ Soch raha hoon...', 'bot');

  try {
    let res, data;

    if (isImageEdit) {
      res = await fetch('/api/image-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: payloadText,
          image: payloadImage.base64,
        }),
      });
      data = await res.json();
      loadingMsg.remove();
      if (!res.ok) throw new Error(data.error || 'Image edit failed');

      if (data.imageUrl) addMsg('✅ Edited image:', 'bot', data.imageUrl);
      else if (data.b64) addMsg('✅ Edited image:', 'bot', `data:image/png;base64,${data.b64}`);
      else addMsg('⚠️ Response:\n' + JSON.stringify(data.raw, null, 2), 'bot');
    }
    else if (isImageGen) {
      res = await fetch('/api/image-gen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: payloadText }),
      });
      data = await res.json();
      loadingMsg.remove();
      if (!res.ok) throw new Error(data.error || 'Image generation failed');

      if (data.imageUrl) addMsg('🎨 Generated image:', 'bot', data.imageUrl);
      else if (data.b64) addMsg('🎨 Generated image:', 'bot', `data:image/png;base64,${data.b64}`);
      else addMsg('⚠️ Response:\n' + JSON.stringify(data.raw, null, 2), 'bot');
    }
    else {
      res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: payloadText,
          model,
          sessionId: currentSessionId,
        }),
      });
      data = await res.json();
      loadingMsg.remove();
      if (!res.ok) throw new Error(data.error || 'Chat failed');

      if (data.sessionId) currentSessionId = data.sessionId;

      if (model === 'gemmacode' && data.reply) addCodeMsg(data.reply);
      else addMsg(data.reply || '(khali)', 'bot');
    }
  } catch (err) {
    loadingMsg.remove();
    addMsg('❌ Error: ' + err.message, 'bot', null, 'error');
  } finally {
    isSending = false;
    sendBtn.disabled = false;
    messageInput.focus();
  }
}

modelSelect.addEventListener('change', () => {
  const v = modelSelect.value;
  if (v === 'imageedit') messageInput.placeholder = 'Edit prompt + image upload karein';
  else if (v === 'imagegen') messageInput.placeholder = 'Image describe karein (Flux)';
  else messageInput.placeholder = 'Apna sawal likhein...';
});
