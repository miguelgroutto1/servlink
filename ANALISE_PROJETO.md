# 📊 Análise do Projeto ServLink

## O que é o ServLink?

O ServLink é um marketplace de serviços locais que desenvolvemos para o nosso TCC. A ideia surgiu porque sempre foi difícil encontrar profissionais confiáveis para fazer serviços em casa - seja um encanador, eletricista, pedreiro ou qualquer outro tipo de serviço.

A plataforma conecta quem precisa de serviços com quem oferece, facilitando todo o processo: desde a busca até a avaliação do serviço prestado.

---

## Por que esse projeto?

Todos nós já passamos pela situação de precisar de um profissional e não saber onde encontrar. Os métodos tradicionais - perguntar para conhecidos, procurar em grupos do Facebook, olhar anúncios - são limitados e não têm muita transparência.

Pensamos: "Por que não criar uma plataforma simples onde profissionais podem se cadastrar e clientes podem encontrar, avaliar e contratar de forma fácil?" E assim nasceu o ServLink.

---

## O que o sistema faz?

### Para Clientes:
- Buscar serviços por categoria, localização ou palavra-chave
- Ver perfis detalhados dos profissionais com avaliações
- Agendar serviços diretamente pela plataforma
- Conversar com o profissional através do chat integrado
- Avaliar o serviço prestado após a conclusão
- Acompanhar histórico de agendamentos no dashboard

### Para Profissionais:
- Cadastrar seus serviços com descrição, preços e fotos
- Receber agendamentos de clientes
- Confirmar ou cancelar agendamentos
- Conversar com clientes através do chat
- Ver avaliações recebidas
- Acompanhar estatísticas no dashboard (quantos serviços, receita, etc.)

---

## Como funciona tecnicamente?

### Tecnologias que usamos:
- **HTML, CSS e JavaScript puro** - Sem frameworks pesados, código limpo e fácil de entender
- **localStorage** - Todos os dados ficam salvos no navegador, então funciona até offline
- **VLibras** - Integrado para tornar o site acessível em Libras

### Arquitetura:
O sistema é 100% frontend. Isso significa que não precisa de servidor ou banco de dados rodando - tudo funciona direto no navegador usando localStorage. Foi uma escolha consciente para simplificar e tornar o projeto mais fácil de apresentar e testar.

---

## Pontos fortes do projeto

### 1. Funcionalidade completa
Não é só um catálogo de serviços. Tem busca, agendamento, chat, avaliações - tudo integrado em um só lugar.

### 2. Interface moderna
Design limpo e responsivo que funciona bem tanto no celular quanto no computador. Tem até modo escuro!

### 3. Fácil de usar
A interface é intuitiva. Qualquer pessoa consegue usar sem precisar de tutorial.

### 4. Acessível
Integramos o VLibras para que pessoas surdas também possam usar a plataforma.

### 5. Funciona offline
Como usa localStorage, o sistema funciona mesmo sem internet (os dados ficam salvos no navegador).

---

## Desafios que enfrentamos

### 1. Organização do código
Com tantas funcionalidades, foi importante manter o código organizado. Criamos funções modulares e bem documentadas.

### 2. Gerenciamento de estado
Como não usamos framework, tivemos que gerenciar manualmente o estado da aplicação (quem está logado, quais serviços existem, etc.). O localStorage ajudou muito nisso.

### 3. Sincronização de dados
Garantir que quando um dado é atualizado (ex: um agendamento é confirmado), todas as telas que mostram esse dado sejam atualizadas também.

### 4. Validações
Implementar validações adequadas nos formulários para evitar dados inválidos.

---

## O que aprendemos

### Técnico:
- Como estruturar um projeto frontend grande sem usar frameworks
- Trabalhar com localStorage de forma eficiente
- Criar uma interface responsiva do zero
- Integrar bibliotecas externas (VLibras, Font Awesome)

### Processo:
- A importância de planejar antes de codificar
- Como dividir funcionalidades grandes em partes menores
- Testar constantemente durante o desenvolvimento
- Documentar o código para facilitar manutenção

---

## Melhorias futuras (se tivéssemos mais tempo)

### 1. Backend real
Adicionar um servidor com banco de dados para persistir dados entre diferentes dispositivos.

### 2. Sistema de pagamento
Integrar com gateways de pagamento para permitir pagamento direto na plataforma.

### 3. Notificações push
Avisar usuários sobre novos agendamentos ou mensagens em tempo real.

### 4. Geolocalização
Usar a localização do usuário para mostrar serviços mais próximos automaticamente.

### 5. Sistema de verificação
Verificar documentos e identidade dos profissionais para maior segurança.

---

## Conclusão

O ServLink foi um projeto desafiador mas muito gratificante. Conseguimos criar uma plataforma completa e funcional que realmente resolve um problema real. 

A escolha de fazer tudo em frontend com localStorage foi acertada - simplificou muito o desenvolvimento e a apresentação, e o sistema funciona perfeitamente para demonstrar todas as funcionalidades.

Estamos orgulhosos do resultado e esperamos que o projeto possa ser útil para outras pessoas também!

---

## Estrutura de dados

O sistema armazena os seguintes dados no localStorage:

- **servlink_users**: Lista de todos os usuários (clientes e profissionais)
- **servlink_services**: Serviços cadastrados pelos profissionais
- **servlink_appointments**: Agendamentos criados
- **servlink_messages**: Mensagens trocadas entre usuários
- **servlink_reviews**: Avaliações feitas pelos clientes
- **servlink_token**: Token de autenticação do usuário logado
- **servlink_user**: Dados do usuário atualmente logado

---

## Como testar

O sistema já vem com usuários de demonstração criados automaticamente:

**Cliente:**
- Email: `maria@example.com`
- Senha: `123456`

**Profissionais (todos com senha `123456`):**
- `joao@example.com` - Serviços Gerais
- `carlos@example.com`, `roberto@example.com`, `fernando@example.com` - Pedreiros
- `paulo@example.com`, `marcos@example.com`, `ricardo@example.com`, `andre@example.com` - Encanadores
- `lucas@example.com`, `felipe@example.com` - Eletricistas
- `gabriel@example.com` - Jardineiro

Todos os profissionais já têm um serviço cadastrado para facilitar os testes!

---

**Desenvolvido com dedicação para o TCC em Tecnologia em Análise e Desenvolvimento de Sistemas - ETEC**

