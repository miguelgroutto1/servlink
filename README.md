# 📱 ServLink — Marketplace de Serviços Locais

## Descrição do Projeto

O **ServLink** é uma plataforma desenvolvida para conectar clientes a profissionais locais de forma simples e eficiente. O sistema permite que profissionais cadastrem seus serviços e que clientes busquem, agendem e avaliem serviços diversos, oferecendo uma experiência completa desde a descoberta até a avaliação do serviço prestado.

### Funcionalidades Principais

- Autenticação completa (login, registro e gestão de perfil)
- Busca avançada de serviços com filtros por categoria, localização e preço
- Sistema de agendamentos com gestão de status
- Chat integrado entre cliente e profissional
- Sistema de avaliações e comentários
- Dashboards para clientes e profissionais
- Interface responsiva com modo escuro/claro
- Acessibilidade com integração VLibras (Libras)

---

## Objetivo

Facilitar a conexão entre pessoas que precisam de serviços e profissionais locais que os oferecem, proporcionando uma plataforma completa que inclui busca, agendamento, comunicação e avaliação, tudo em um único lugar.

---

## Tecnologias Utilizadas

- **Front-end**: HTML5, CSS3, JavaScript puro.
- **Armazenamento**: localStorage (não requer banco de dados).
- **Ferramentas**: Node.js (apenas para desenvolvimento local com http-server).
- **Bibliotecas**: Font Awesome, Google Fonts (Outfit), VLibras.

---

## 📁 Estrutura do Projeto

```
ServLink/
├── frontend/
│   ├── src/
│   │   ├── pages/          # Páginas HTML
│   │   │   ├── index.html
│   │   │   ├── auth.html
│   │   │   ├── dashboard.html
│   │   │   ├── servicos.html
│   │   │   └── ...
│   │   ├── styles/         # Arquivos CSS
│   │   ├── js/            # JavaScript principal
│   │   └── images/        # Imagens e logo
│   └── test.html          # Página de testes
└── README.md
```

---

## Como Executar

### Opção 1: Abrir diretamente no navegador
Abra o arquivo `frontend/src/pages/index.html` ou `frontend/test.html` diretamente no navegador.

### Opção 2: Servir com http-server (requer Node.js)
```bash
cd frontend
npm install
npm start
```

---

## Trabalho de Conclusão de Curso (TCC)

Este projeto foi desenvolvido como Trabalho de Conclusão de Curso em **Técnico em Desenvolvimento de Sistemas**.

### Instituição
ETEC - Rodrigues de Abreu

### Equipe de Desenvolvimento
- Marco Antonio Angioletto Capano
- Miguel Groutto Rocha
- Valente da Piedade Sassento
- Wellington Gonçalves Salvador

### Orientador
*   Prof. Jefferson Roger Moreira

### Ano
2025

---

## Documentação

Para mais informações técnicas sobre o projeto, consulte:
- [Análise do Projeto](ANALISE_PROJETO.md)

- ---

 Obrigado pela atenção! 👋🏻
