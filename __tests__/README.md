# LHSSH Tests

Este diretório contém os testes para a biblioteca LHSSH.

## Estrutura dos Testes

### `lhssh.spec.ts`

Testes unitários principais que cobrem:

- Constructor e inicialização
- Método `connect()` e tratamento de eventos
- Método `exec()` para execução de comandos
- Método `shell()` para sessões interativas
- Método `write()` para envio de dados
- Métodos `readUntil()` e `addReadHandler()`
- Processamento de dados com `onData()`
- Métodos de cleanup `end()` e `close()`

### `lhssh.integration.spec.ts`

Testes de integração que cobrem:

- Validação de configuração SSH
- Cenários de tratamento de erro
- Padrões de uso em cadeia (method chaining)
- Gerenciamento de recursos
- Gerenciamento de buffer

## Como Executar os Testes

### Executar todos os testes

```bash
npm test
```

### Executar testes em modo watch

```bash
npm run test:watch
```

### Executar testes com coverage

```bash
npm run test:coverage
```

### Executar testes específicos

```bash
# Executar apenas testes unitários
npx jest lhssh.spec.ts

# Executar apenas testes de integração
npx jest lhssh.integration.spec.ts
```

## Cobertura de Testes

Os testes cobrem:

- ✅ Todas as funções públicas
- ✅ Todos os caminhos de erro
- ✅ Eventos de conexão SSH
- ✅ Gerenciamento de estado
- ✅ Processamento de dados
- ✅ Cleanup de recursos

## Mocks

Os testes utilizam mocks do módulo `ssh2` para simular:

- Conexões SSH
- Streams de dados
- Eventos de erro
- Callbacks assíncronos

## Estrutura dos Mocks

```typescript
// Mock do ssh2.Client
const mockClient = {
  on: jest.fn().mockReturnThis(),
  connect: jest.fn(),
  exec: jest.fn(),
  shell: jest.fn(),
  end: jest.fn(),
};
```

## Cenários de Teste

### Conexão

- ✅ Conexão bem-sucedida
- ✅ Erro de conexão
- ✅ Conexão rejeitada
- ✅ Eventos de close

### Execução de Comandos

- ✅ Comando executado com sucesso
- ✅ Comando com erro
- ✅ Comando sem stream
- ✅ Auto-conexão quando desconectado

### Sessão Interativa

- ✅ Abertura de shell
- ✅ Escrita de dados
- ✅ Leitura até marcador
- ✅ Handlers de leitura

### Gerenciamento de Buffer

- ✅ Processamento de dados
- ✅ Múltiplos handlers
- ✅ ReadUntil com buffer
- ✅ Cleanup de buffer
