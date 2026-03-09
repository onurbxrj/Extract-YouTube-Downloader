# 🔍 Relatório de Debug: Youtube Video Unavailable (yt-dlp exited with code 1)

### 1. Symptom
No terminal do Node.js, observamos que desta vez o **yt-dlp.exe foi baixado e salvo com sucesso (17.56 MB)**, o que significa que o erro do 0-bytes EPTYPE do Node v24 foi 100% resolvido. No entanto, o processo do `yt-dlp` finalizou sozinho acusando:
- `ERROR: [youtube] o-AH7WoNu...: Video unavailable`

### 2. Information Gathered
O servidor Bridge está recebendo instruções do nosso Service Worker do Chrome dizendo para baixar a URL:
`https://www.youtube.com/watch?v=o-AH7WoNuBbn6tZ3nohOyWyFKQQibxR7F...`
Onde o verdadeiro Video ID (que deveria ter apenas 11 letras clássicas, como `dQw4w9WgXcQ`) está sendo passado como um gigante hash alfa-numérico. 

### 3. Hypotheses
Por que o service-worker enviou esse código insano no lugar do ID do vídeo se nós havíamos criado o "Tab Map" rastreador de abas (`tabVideoIds`) na Fase 6?

### 4. Root Cause
🎯 Na Fase 6, eu escrevi esta linha no `service-worker.js`:
```javascript
videoId = urlObj.searchParams.get('id') || tabVideoIds.get(details.tabId) || 'unknown';
```
A questão técnica é que nas URLs internas de tráfego do Youtube (`googlevideo.com/videoplayback`), o parâmetro HTTP `&id=` é usado de forma nativa pelo Google para representar uma identificação de servidor de Caching/Pedaço de Mídia. 
Sendo assim, o termo `urlObj.searchParams.get('id')` era "Verdadeiro". Como computadores avaliam regras lógicas da Esquerda para a Direita, o código se contentava com esse Hash quebrado e **nunca** chegava no `tabVideoIds.get(details.tabId)` que carregava o seu ID embutido salvo em memória!

### 5. Fix
Vou inverter a arquitetura de fallback no Service Worker agora mesmo.
1. Se a URL for do servidor de tráfego (`googlevideo.com`) ele será **OBRIGADO** a olhar primeiro a nossa tab em memória (que capturou o embed de 11 letras lá do site da Gracademy).
2. O botão "API Server" fará a consulta com o link autêntico e o `yt-dlp.exe` vai finalmente conseguir acessar e decriptografar a aula.

*A correção no Service Worker sendo injetada agora...*
