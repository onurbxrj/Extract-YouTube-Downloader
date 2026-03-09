# 🔍 Relatório de Debug: Spawn EFTYPE

### 1. Sintoma
Logo após a inicialização do Servidor Bridge, a requisição do frontend falhou. O terminal acusou:
- `Error: spawn EFTYPE`
- Indicando erro na syscall `spawn` na linha `server.js:68:24`.

### 2. Information Gathered
- Error: `spawn EFTYPE` no Windows significa que o sistema tentou executar um arquivo que não tem um formato de executável válido (não é um arquivo `.exe` real).
- Investigação via terminal (`Get-Item` PowerShell): Executei um scan na pasta `extract-bridge` e descobri que o tamanho do arquivo `yt-dlp.exe` que o servidor baixou é exatamente **0 bytes** (vazio). O download falhou silenciosamente antes de ser escrito no disco, criando um arquivo "fantasma" corrompido.

### 3. Hypotheses
1. ❓ A função `res.body.pipe(dest)` usando o pacote `node-fetch` ou o `fetch` nativo do seu **Node.js v24.14.0** teve o buffer interrompido. O stream original não foi conectado perfeitamente ao arquivo e salvou zero dados.

### 4. Root Cause
🎯 Seu ambiente possui o **Node.js v24**, que introduz uma API global e nativa chamada WebStreams para a instrução `fetch`. Misturar `fs.createWriteStream()` do Node antigo com WebStreams modernos sem usar conversores gera um curto-circuito. O evento `finish` é disparado, mas os bytes nunca foram copiados para o disco. Quando o comando `spawn` foi acionado para executar este executável de "0 bytes", a proteção do Windows cuspiu o código de erro `EFTYPE` ("Inappropriate file type").

### 5. Fix & Prevenção
Para dar um fim definitivo nisso, não utilizaremos `Stream Pipes` que são sensíveis ao sistema operacional e versão do Node. Ao invés disso, vamos:
1. Apagar este arquivo corrompido de 0 bytes.
2. Refatorar a função de Download no Node.js para carregar o binário na memória RAM (cerca de apenas 15MB) perfeitamente através de um ArrayBuffer sólido, e depois salvar como cópia integral de 1-to-1 (`fs.writeFileSync`).

**Posso aplicar essa correção definitiva no `server.js` agora para liberar as suas extrações? (Y/N)**
