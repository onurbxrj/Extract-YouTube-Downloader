# 🔍 Relatório de Debug: Arquivos Separados (f137) e Erro em Download (POST)

### 1. Symptom
Pelos de tela fornecidos pelo usuário, temos dois problemas críticos restantes:
1. **API Server:** O Bridge baixou com sucesso a aula (Terminal confirmou 97MB e 6MB), porém gerou 2 arquivos desconhecidos (`.f137` e `.f140`) e não montou o Vídeo (MP4).
2. **Download Nativo/HD Mux:** Clicar nos botões azuis e laranjas da extensão na aba da Gracademy, mesmo mostrando o selo verde de `POST`, causou um Toast de "Erro no download".

### 2. Information Gathered
1. `yt-dlp` baixou as "melhores qualidades" separadamente de vídeo e áudio. Pela documentação do projeto do Youtube, após o download de fragmentos separados, o yt-dlp procura invocar discretamente o binário `ffmpeg` no sistema para fundir os dois. Como transformamos o projeto num "Plug and Play" na Fase 7, **o Windows ficou sem FFmpeg**, e o yt-dlp abortou silenciosamente essa etapa criando arquivos inacabados.
2. Na Fase 6, desenvolvi a lógica no `popup.js` para ler o `dataset.method` do botão que você clica e enviar pro `offscreen.js`. Entretanto, investigando o DOM HTML recém-injetado, vi que a chave `data-method="${req.method}"` foi esquecida e nunca repassada aos botões de fato.

### 3. Root Cause
🎯 
- O Servidor Node.js não possui um referencial para um Engine de Áudio e Vídeo nativo.
- O clique da extensão caía num valor vazio (`null || 'GET'`). O seu navegador Chrome disparava requisições `GET` para links da Gracademy protegidos que só aceitavam `POST` (causando o crash imediato reportado).

### 4. Fix
**Back-End (API Server):**
Em vez de pedirmos para você instalar manualmente pacotes malucos de FFmpeg no Windows (mantendo o projeto "plug and play"), instalarei silenciosamente no pacote do Bridge a biblioteca Node `ffmpeg-static` via npm.
Adicionarei o parâmetro explícito: `--ffmpeg-location "${require('ffmpeg-static')}"` ao chamamento do `yt-dlp.exe` nativamente. O vídeo MP4 sairá fundido e montado perfeitamente com áudio! 🎥

**Front-End (Extension Popup):**
Irei corrigir a falha semântica de interface e acoplar a variável `${req.method || 'GET'}` dentro do `dataset` visual de cada botão do Card injetado. Isso fará seus botões Azul e Laranja destrancarem para `POST`.

*Orquestrando a correção nas duas camadas simultaneamente...*
