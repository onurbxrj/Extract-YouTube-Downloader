# 🚀 Extract Local Bridge Server (Plug and Play)

Este é o servidor de apoio local (Backend) da extensão **Extract v2.1**.

Sua única função é contornar as limitações de segurança e CORS do navegador Chrome, disparando downloads nativos do YouTube através do utilitário oficial **yt-dlp**.

## ✨ Novidade na Fase 7: Sem Dependências
Você **NÃO** precisa mais ter o Python instalado! O próprio servidor se encarregará de baixar o executável portátil (`yt-dlp.exe`) oficial diretamente do GitHub no seu primeiro download.

## 🛠️ Como usar

1.  Abra um terminal (Prompt de Comando ou PowerShell).
2.  Navegue até esta pasta:
    ```bash
    cd C:\Bruno\Extract\extract-bridge
    ```
3.  Instale as dependências (se ainda não fez isso):
    ```bash
    npm install
    ```
4.  Inicie o servidor:
    ```bash
    npm start
    ```
5.  Deixe esta janela do terminal **aberta e rodando**.
6.  Volte para o navegador Chrome e use o botão **"🚀 API Server"** na extensão.

## 📁 Onde os vídeos são salvos?

Todos os downloads serão armazenados na pasta `downloads` que fica dentro deste próprio diretório (`C:\Bruno\Extract\extract-bridge\downloads`).

O servidor exibirá mensagens no terminal confirmando o início e a conclusão de cada download. Se for o seu primeiro download, ele mostrará "yt-dlp.exe not found. Downloading from official release..." e baixará o motor em alguns segundos.

## 🛑 Como desligar

Para parar o servidor, simplesmente feche a janela do terminal ou pressione `Ctrl + C` no teclado dentro do terminal onde ele está rodando.

## ⚠️ Requisitos
- Você precisará ter o **Node.js** instalado (v14+ recomentado).
- Precisará ter o **Python** instalado e adicionado ao PATH do Windows para que o `yt-dlp` funcione. Se o comando falhar, instale o Python na [Microsoft Store](ms-windows-store://pdp/?productid=9P7QFQWEBW43) ou [python.org](https://www.python.org/downloads/).
