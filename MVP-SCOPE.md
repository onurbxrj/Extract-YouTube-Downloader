# MVP Scope

## Must Have

Captura de requisições via webRequest

Filtro de URLs contendo:

youtube.com
/embed/
videoplayback
watch

Extração de:

Method
Authority
Path

Armazenamento das últimas 5 requisições

Popup simples exibindo:

Authority
Path

Filtro por aba ativa

---

## Should Have

Timestamp da requisição

Atualização automática ao abrir popup

---

## Could Have

Export JSON

Filtro de domínio

Captura de headers adicionais

---

## Fora do MVP

DevTools Panel customizado

Timeline de requisições

Análise de payload

Captura de response

Suporte multi players (Vimeo etc)

UI avançada

---

# Hipóteses do MVP

A maioria dos embeds de YouTube dispara requisições contendo `/embed/`.

Interceptação via `onBeforeSendHeaders` será suficiente para capturar dados relevantes.

Filtrar por `tabId` evitará poluição entre abas.

---

# Métricas de Sucesso

Requisições capturadas corretamente em páginas com embed

Popup mostrando dados em tempo real

Histórico limitado funcionando corretamente
