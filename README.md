# Extract v2 — YouTube Embed Download Manager

> Extensão moderna para Chrome e Servidor Node.js para habilitar downloads nativos de vídeos do YouTube protegidos por DRM suave e embeds privados (Gracademy, Kajabi, Hotmart, etc).

## 🚀 Como Funciona
A arquitetura do projeto opera de forma híbrida combinando a agilidade do navegador com a robustez de um backend local/remoto para bypass de restrições de criptografia Muxer (`.f137` + `.f140` separação).

1. **Frontend (Chrome Extension):** Injeta um interceptador HTTP global no navegador observando tráfego do domínio `googlevideo.com/videoplayback`.
2. **Backend (Bridge Server):** Um container autônomo e "Plug and Play" feito em Node.js. Ele orquestra os processos do famoso `yt-dlp` e os compila usando um binário nativo do `ffmpeg` embarcado na própria biblioteca.

---

## 💻 Tech Stack & Features
- **UI:** Vanilla JS + CSS3 (Vercel Linear Design, Ghost Buttons, Dark Mode).
- **Extension API:** Chrome Manifest V3 + Service Workers persistentes.
- **Backend:** Node.js (Express) com acoplamento assíncrono do Child Process.
- **Core Libs:** `yt-dlp` (via release binário auto-baixado), `ffmpeg-static` (Node NPM).

---

## 📦 Instalação do Cliente (Browser)
1. Salve esta pasta no seu computador.
2. Abra o Google Chrome e digite na barra de endereços: `chrome://extensions`.
3. Ative a alavanca **Modo do desenvolvedor** no canto superior direito.
4. Clique em **Carregar sem compactação** e selecione a sub-pasta raiz (onde está o `manifest.json`).
5. Fixe a extensão no seu painel.

---

## ☁️ Manual de Deploy do Servidor (VPS Linux)

Para executar o "Bridge Server" em um servidor na nuvem (VPS na DigitalOcean, AWS, Hostinger, contendo Ubuntu 22.04+), siga os passos abaixo para mantê-lo rodando 24/7 de forma segura.

### Requisitos Prévios
- Servidor rodando Ubuntu/Debian.
- Node.js (v18+) e NPM instalados.
- PM2 (Gerenciador de processos do Node.js).

### Passo 1: Transferir os Arquivos e Setup
Envie apenas a pasta `extract-bridge` para sua VPS. Entre nela e instale as dependências.
```bash
cd extract-bridge
npm install
```

### Passo 2: O Binário yt-dlp & FFmpeg
A nossa arquitetura já foi planejada para **não precisar de pacotes adicionais do apt-get!** 
O comando `npm install` instalou o `ffmpeg-static` diretamente na pasta `node_modules` contendo o binário pronto para Linux. Na primeira execução do servidor, o próprio Node.js fará o download da versão correta do `yt-dlp` (linux) e alocará na memória/disco. 

### Passo 3: PM2 (Process Manager)
Para que o servidor de download não morra quando você fechar a aba do terminal da VPS (SSH), precisamos de um daemon.
```bash
# Instale o PM2 globalmente no Linux
sudo npm install -g pm2

# Inicie o Bridge Server
pm2 start server.js --name "extract-bridge"

# Configure o PM2 para ligar automaticamente caso o servidor Linux reinicie
pm2 startup
pm2 save
```

### Passo 4: Conectando no Chrome
Por padrão o servidor roda na porta `3010`. Em sua máquina local, sinta-se livre para acessar o `service-worker.js` da Extensão Chrome (linha do fetch) e trocar o `http://localhost:3010/download` pelo IP da sua VPS: `http://<IP_DA_SUA_VPS>:3010/download`.

**⚠️ Atenção à Segurança:** Se o servidor estiver público e exposto na rede mundial, use Nginx como Proxy Reverso com Certificado SSL grátis do Let's Encrypt para fornecer acesso HTTPS seguro ao endpoint.

---

## 📝 Changelog Recentes

### [2.1.0] - 2026-03-09
#### Adicionado
- Extensão convertida para "Plug and Play": autoinstalação do `yt-dlp` omitindo Python Environment;
- Fusão de vídeos e áudios separadas habilitada via pacote npm `ffmpeg-static`;
- Botões de painel local de Settings e simplificação de UI para leigos.
#### Resolvido
- Crash em requisições protegidas por bloqueio de rotas HTTP HEAD e GET convertido para requisições POST com sucesso.

---

## Licença
MIT
