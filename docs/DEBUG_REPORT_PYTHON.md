# 🔍 Relatório de Debug: Extract Bridge (Python 9009)

### 1. Sintoma
Na extensão, ao clicar em "🚀 API Server", aparece o toast de erro: `Falha Server: Download failed`.
No terminal (`extract-bridge`), o Node.js cospe os erros:
- `Python was not found; run without arguments to install from the Microsoft Store...`
- `[!] yt-dlp child process exited with code 9009`

### 2. Information Gathered
- Error: Código de saída `9009` do Windows CMD para "Comando não encontrado".
- Contexto: O script `extract-bridge/server.js` tenta iniciar um processo utilizando o comando `python`. No sistema operacional Windows atual (onde o `npm start` está rodando), o interpretador da linguagem Python não está instalado ou não foi adicionado às Variáveis de Ambiente (PATH).

### 3. Hypotheses
1. ❓ **Causa Única:** O Windows interceptou a chamada `python` porque o interpretador não existe na máquina. A Opção B (Bridge Server) que desenhamos dependia da pasta local `yt-dlp-master`, cujo código fonte de extração é 100% nativo em Python.

### 4. Fix (Plano de Correção)
Temos duas formas definitivas de resolver:

- **Estratégia 1 (Manual):** Você fecha esse terminal, vai no [site do Python (python.org/downloads)](https://www.python.org/downloads/), baixa o instalador do Windows, marca a caixinha **"Add python.exe to PATH"** durante a instalação e pronto. A pasta local `yt-dlp-master` voltará a funcionar perfeitamente.
- **Estratégia 2 (Refatoração para yt-dlp.exe):** Para não exigir que VOCÊ (nem seus futuros clientes) instalem o Python no computador, eu posso reescrever o `server.js` para não usar a pasta `yt-dlp-master` (código-fonte bruto) e passar a usar a versão compilada oficial do `yt-dlp.exe` que já vem com o Python injetado dentro dela (é um arquivo único executável para Windows baixado do Github deles).

### 5. Execução recomendada
Eu recomendo fortemente a **Estratégia 2**. Se você concordar:
1. Vou modificar o `server.js` para usar um binário portátil (`yt-dlp.exe`).
2. Adicionarei um script que faz o auto-download do `.exe` direto do repositório deles caso ele não exista na sua pasta, tornando o sistema 'Plug and Play'.

Você aprova a execução da **Estratégia 2**? (Y/N)
