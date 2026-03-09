# 🔍 Relatório de Debug & Arquitetura (Fase 5 - Gracademy)

## 1. Problema A: Botão "🚀 API Server" não aparece
### 1.1 Sintoma
A requisição foi capturada no popup, mas os botões baseados em yt-dlp ("API Server") não foram renderizados, restando apenas os botões nativos (Download / HD Mux). 

### 1.2 Causa Raiz (Root Cause)
O botão da API depende da variável `req.videoId` (o código de 11 letras do YouTube, ex: `dQw4w9WgXcQ`). Contudo, o código tentou extrair esse ID diretamente do link do chunk de vídeo (`/videoplayback`). Links de `/videoplayback` **não** contêm o Video ID do YouTube, eles contêm apenas IDs de fragmentos (DASH `id` / event `ei`). Logo, o `videoId` ficava inválido e o botão foi ocultado preventivamente para não gerar links 404.

### 1.3 Solução Arquitetural
Adicionar um ouvinte global no `service-worker.js` que observe quando o iframe inicializa (requisição para `https://www.youtube.com/embed/XXXXXX`). Ele mapeará o ID `XXXXXX` à aba atual (`tabId`). Quando a requisição `/videoplayback` acontecer segundos depois, ela buscará o Video ID correto neste mapa da aba e liberará a ponte local para o yt-dlp.

---

## 2. Problema B: Botão "HD Mux" falhando com "Erro Desconhecido"
### 2.1 Sintoma
Ao clicar em "HD Mux", aparece o toast de erro "Mux falhou: Erro desconhecido".

### 2.2 Causa Raiz (Root Cause)
Como visto na sua captura de tela (POST 720p Video / POST 160KBPS Audio), no ambiente da Gracademy os vídeos estão sendo transmitidos via requisições **POST**. 
A função `fetchWithProgress` dentro do componente que alimenta o FFmpeg (`offscreen.js`) estava hardcoded (fixada) para fazer requisições **GET** (`method: 'GET'`). O servidor do YouTube negava o fetch (HTTP 400 Bad Request / 405 Method Not Allowed), interrompendo o fluxo antes do FFmpeg começar.

### 2.3 Solução Arquitetural
Modificar o contrato de mensagens do Mux. A extensão deve passar o método original da requisição (`GET` ou `POST`) para o arquivo `offscreen.js`. Se for `POST`, a própria interface de Fetch precisará repassar isso. (Para streams que exigem corpo POST, muitas vezes são sinais de DRM, onde a única saída viável se torna a Opção B - API Server).

---

## 3. Plano de Implantação Direta
Se aprovado, farei as 3 modificações nos arquivos agora mesmo em apenas 1 commit:
1. **`service-worker.js`**: Monitorar e salvar URLs `/embed/:id` via `tabId`.
2. **`popup.js` e `popup.html`**: Forçar envio do `method` em todos os downloads, exibir botão "API Server" com fallback confiável e limpar cache de requests.
3. **`offscreen.js`**: Atualizar o `fetchWithProgress` para herdar o `method` original (GET/POST) corrigindo o erro CROS HTTP.

Você aprova a execução desta correção imediata? (Y/N)
