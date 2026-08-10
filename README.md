# 🌿 Amazonia Explorer - Guia Turístico & Venda de Ingressos

Bem-vindo ao **Amazonia Explorer**, uma plataforma web completa para a reserva e venda de ingressos de expedições turísticas guiadas na Floresta Amazônica.

## 🚤 Sobre o Projeto

O **Amazonia Explorer** oferece aos turistas uma experiência inesquecível de imersão na biodiversidade amazônica. Navegando pelas águas do majestoso **Rio Amazonas** a bordo de embarcações preparadas e seguras, os visitantes têm a oportunidade de explorar a fauna, a flora e as comunidades ribeirinhas locais.

A plataforma funciona como um **guia turístico digital** e **sistema de bilhetagem online**, permitindo aos clientes explorar roteiros, visualizar itinerários e adquirir seus ingressos de forma rápida, intuitiva e totalmente protegida.

---

## 🔒 Compromisso com a Segurança

A segurança dos dados dos usuários e das transações financeiras é a nossa prioridade máxima. O projeto implementa rigorosos padrões de segurança tanto no fluxo de compra quanto na infraestrutura de banco de dados e servidores:

### 🎟️ 1. Segurança na Compra de Ingressos
- **Processamento de Pagamento Seguro:** Integração com gateways de pagamento homologados e em conformidade com padrões de mercado.
- **Criptografia de Ponta a Ponta:** Conexão HTTPS/TLS para garantir que os dados bancários e pessoais transitem de forma segura.
- **Validação de Ingressos:** Geração de bilhetes com identificadores únicos e verificação anti-fraude para evitar duplicidades.

### 🛡️ 2. Segurança de Banco de Dados e Servidores
- **Controle de Acesso por Linha (Row Level Security - RLS):** Políticas de acesso restritas no banco de dados, garantindo que usuários acessem estritamente seus próprios dados e ingressos.
- **Gerenciamento Moderno de API Keys:** Utilização de chaves publicáveis (`sb_publishable_...`) apenas para o cliente e chaves secretas (`sb_secret_...`) restritas a ambientes de servidor seguros.
- **Proteção contra Vulnerabilidades:** Sanitização de dados para prevenção de SQL Injection, XSS e CSRF.
- **Isolamento de Variáveis de Ambiente:** Separação rigorosa de credenciais e segredos em arquivos de ambiente não versionados.

---

## 🛠️ Tecnologias e Arquitetura

- **Frontend:** HTML5, Vanilla CSS (Design Moderno & Responsivo), JavaScript.
- **Backend & Banco de Dados:** Banco de dados relacional seguro com suporte a RLS (Supabase).
- **Segurança:** Autenticação robusta, criptografia de tokens e chaves de API modernas.

---

## 📌 Funcionalidades Principais

- 🗺️ **Guia Turístico Interativo:** Apresentação da fauna, flora e roteiros dos passeios de barco pelo Rio Amazonas.
- 📅 **Reserva & Agendamento:** Seleção de datas, itinerários e quantidade de ingressos.
- 💳 **Checkout Seguro:** Venda de ingressos com validação e confirmação instantânea.
- 🎟️ **Ticket Digital:** Emissão de ingresso digital seguro para embarque.
