
Relatório Técnico: Implementação de Captura e Conversão HLS (m3u8)

1. Visão Geral do Sistema

O sistema visa replicar a funcionalidade de ferramentas como o  _Video DownloadHelper_, permitindo a detecção de fluxos de vídeo adaptativos (HLS), o download de seus fragmentos e a consolidação em um arquivo de mídia único (MP4).

2. Arquitetura de Componentes

Componente

Função Técnica

Tecnologia Sugerida

**Sniffer de Rede**

Monitora o tráfego HTTP para capturar arquivos  `.m3u8`.

WebRequest API (Extensões) / Puppeteer (Automação)

**HLS Parser**

Analisa o manifesto, resolve URLs relativas e seleciona a resolução.

m3u8-parser (JS) / m3u8 (Python)

**Gestor de Download**

Realiza o download assíncrono e paralelo dos segmentos  `.ts`.

Axios / Aiohttp (Python)

**Mecanismo de Transcodificação**

Concatena os segmentos e altera o container para MP4.

FFmpeg (Core Engine)

3. Fluxo de Execução (Step-by-Step)

Fase 1: Detecção e Resolução

O sistema deve filtrar a requisição da  **Master Playlist**. Caso existam múltiplas resoluções, a lógica deve selecionar a de maior largura de banda (`BANDWIDTH`) ou seguir a preferência do usuário.

-   **Tag Alvo:**  `#EXT-X-STREAM-INF`  (para variantes) e  `#EXTINF`  (para segmentos).

Fase 2: Gestão de Segmentos

Os arquivos  `.ts`  devem ser baixados seguindo a ordem da  **Media Playlist**.

-   **Importante:**  Implementar um buffer local ou fila de download para gerenciar falhas de rede em segmentos específicos sem interromper o processo global.

Fase 3: Processamento com FFmpeg

A conversão não deve ser feita manualmente via código "puro", mas sim através do  `ffmpeg`, que lida com a sincronização de timestamps e codecs.

**Comando de Implementação:**

bash

```
ffmpeg -protocol_whitelist file,http,https,tcp,tls -i "input.m3u8" -c copy -bsf:a aac_adtstoasc output.mp4

```

Use o código com cuidado.

-   **`-c copy`**: Modo  _Stream Copy_  (não consome CPU para recodificar, apenas move os dados).
-   **`-bsf:a aac_adtstoasc`**: Necessário para converter o fluxo de áudio MPEG-2/TS para o formato compatível com MP4.

4. Desafios e Requisitos de IA

Para que uma IA implemente isso com sucesso, ela deve considerar:

1.  **CORS & Referer:**  Muitas requisições de segmentos exigem os headers  `Referer`  e  `User-Agent`  originais da sessão do navegador.
2.  **AES-128 Decryption:**  Se o manifesto contiver a tag  `#EXT-X-KEY`, a IA precisará implementar a lógica de captura da chave e descriptografia dos blocos via OpenSSL/FFmpeg.
3.  **Gerenciamento de Disco:**  O sistema deve prever espaço temporário para os segmentos antes da unificação.

5. Próximos Passos Recomendados

1.  **Definição da Stack:**  Escolha entre uma solução baseada em Node.js (facilita integração com navegador) ou Python (melhor para processamento pesado).
2.  **Integração do FFmpeg:**  Garantir que o binário do FFmpeg esteja disponível no ambiente de execução (Path).

----------
