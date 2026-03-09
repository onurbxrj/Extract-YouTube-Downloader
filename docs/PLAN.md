# PLAN.md: Integração do yt-dlp no Extract v2.1

## 1. O Problema Atual
A abordagem inicial capturava streams baseados em requisições GET (`/videoplayback`). Porém, o YouTube divide vídeos de alta qualidade em múltiplos chunks DASH e criptografa alguns formatos, tornando o download unificado direto no navegador frágil e sujeito a erros CORS/NetworkError, ou com links que expiram rapidamente.

## 2. A Solução: yt-dlp-master
A biblioteca `yt-dlp` (presente na pasta `yt-dlp-master`) é o padrão ouro na indústria para desvios de proteções e extração de vídeos do YouTube. Como é baseada em Python, **não pode rodar nativamente dentro da Extensão do Chrome** (Javascript sandbox). Ela requer acesso ao sistema de arquivos do SO.

## 3. Análise Arquitetural (Trade-offs)

Para que a Extensão se comunique com o `yt-dlp`, temos duas abordagens principais:

### Opção A: Native Messaging Host (Avançado)
A extensão se comunica diretamente com um script Python executado no SO, registrado no Chrome via um arquivo Manifest no sistema.
- **Prós:** Inicia sob demanda (não exige servidor de fundo rotando 24x7). Totalmente integrado.
- **Contras:** A instalação é muito complexa (requer criação de chaves de Registro no Windows para que o Chrome confie no script Python).

### Opção B: Local Bridge API Server (Recomendado)
Um pequeno servidor local (em Node.js ou FastAPI Python) que roda em plano de fundo (`http://localhost:3010`) utilizando o `yt-dlp`. A extensão faz um simples `fetch/POST` para este servidor passando a URL. O servidor baixa via `yt-dlp` e envia o MP4 final de volta para a extensão ou salva diretamente na pasta Downloads.
- **Prós:** Extremamente fácil de configurar e debugar. Contorna qualquer bloqueio do YouTube porque o request sai do backend Python, não do navegador do usuário.
- **Contras:** O usuário (você) precisará rodar um comando (`node server.js` ou `python server.py`) para iniciar o bridge antes de usar o download.

---

## 4. Estratégia Recomendada e Plano de Execução

Recomendamos fortemente a **Opção B (Local Bridge API)** utilizando um script Node.js ou Python simples que engloba o `yt-dlp-master`.

### Fases de Implementação (Fase 2 da Orquestração)

1. **Backend (Servidor Bridge)**:
   - Criar uma pasta `extract-bridge/` na raiz.
   - Escrever um `server.js` (Express CLI) que recebe requests POST.
   - Este servidor executa o binário Python do `yt-dlp-master` (ex: `python yt-dlp-master/yt_dlp/__main__.py -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]" <URL>`).
   
2. **Extensão (Frontend/UI)**:
   - Atualizar `popup.js` para enviar o link do YouTube ativo para o `localhost:3010`.
   - Adicionar mecanismo de UI "Fallback" alertando se o Bridge Server local não estiver rodando ("Servidor local offline").

3. **Validação & Teste**:
   - Baixar um vídeo restrito ou segmentado com o novo fluxo para garantir a estabilidade.

## 5. Próximos Passos
Se você aprovar esta arquitetura (Opção B), os sub-agentes `backend-specialist` (Node/Python wrapper), `frontend-specialist` (mudança na Extensão) e `database-architect` (setup local) entrarão em ação de forma simultânea.
