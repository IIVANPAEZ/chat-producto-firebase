# Chat de producto con Firebase Realtime + NestJS

Chat entre un **cliente móvil** (React Native) y un **comercio web** (React) sobre Firebase Realtime Database. El comercio puede enviar en cualquier momento una oferta de producto; el cliente la aprueba o la rechaza, y al aprobarla el pedido se guarda en una **API NestJS**.

| Carpeta | Pieza | Stack |
|---|---|---|
| `api/` | API de pedidos (REST, sin Firebase) | NestJS 12, class-validator, Vitest |
| `app-cliente/` | Cliente móvil | React Native 0.88 (CLI), Firebase JS SDK, Jest |
| `app-comercio/` | Comercio web | React 19 + Vite, Firebase JS SDK, Vitest |
| `firebase/` | Reglas de Realtime Database | `database.rules.json` |

**chatId de la demo:** `chat-demo-001` (configurable por variable de entorno en las tres piezas).

---

## Requisitos

- **Node 22** (≥ 22.11). En la raíz hay un `.nvmrc`: `nvm use`.
- npm 10 u 11.
- Un proyecto de **Firebase** con Realtime Database.
- Para el cliente móvil:
  - Android: Android Studio con un emulador, JDK 17 y `ANDROID_HOME` configurado.
  - iOS: Xcode y CocoaPods (macOS).

> Si `npm install` falla con `Cannot read properties of null (reading 'edgesOut')` (bug de npm 10 al resolver dependencias), usar npm 11: `npx npm@11 install`.

---

## 1. Firebase

1. Crear un proyecto en la [consola de Firebase](https://console.firebase.google.com) y agregar **Realtime Database**.
2. En *Realtime Database → Reglas*, pegar el contenido de [`firebase/database.rules.json`](firebase/database.rules.json) y publicar.
3. En *Configuración del proyecto → Tus apps*, registrar una **app web**. Del `firebaseConfig` se usan `apiKey`, `authDomain`, `databaseURL`, `projectId` y `appId`. La misma configuración sirve para las dos aplicaciones (ambas usan el SDK JS de Firebase).

Las credenciales van solo en archivos `.env`, que están ignorados por git. Cada pieza trae un `.env.example`.

---

## 2. API (`api/`)

```bash
cd api
npm install
cp .env.example .env
npm run start:dev
```

Queda escuchando en `http://localhost:3000`.

| Variable | Valor por defecto | Descripción |
|---|---|---|
| `PORT` | `3000` | Puerto HTTP |
| `ORDERS_FILE_PATH` | `orders.json` | Archivo donde se guardan los pedidos (relativo a `api/`) |
| `CHAT_ID` | — | Si está definido, rechaza pedidos de otro chat |
| `CORS_ORIGIN` | `*` | Orígenes permitidos, separados por coma |

### Endpoints

`POST /orders` — crea el pedido. Responde **201**, o **200** si ya existía un pedido para el mismo `chatId` + `messageId` (es idempotente: reintentar no duplica pedidos).

```bash
curl -X POST http://localhost:3000/orders \
  -H 'Content-Type: application/json' \
  -d '{
    "chatId": "chat-demo-001",
    "messageId": "-Omsg1",
    "product": { "id": "p-101", "name": "Bandeja paisa", "price": 32000, "currency": "COP" }
  }'
```

Devuelve **400** si falta `chatId` o `product.id`, si `price` no es mayor que cero, si `currency` no es un código ISO 4217, o si llegan campos de más.

`GET /orders/:id` — devuelve el pedido, o **404** si no existe.

### Ejemplo de pedido guardado en `orders.json`

```json
[
  {
    "id": "6d5a1d6a-024d-4995-bfdb-e84e7d568ee6",
    "chatId": "chat-demo-001",
    "messageId": "-P6HlgthwBUe_V57OTWg",
    "product": {
      "id": "prod-97cded16-5c38-4fb0-ada8-04d08f7281d9",
      "name": "Bandeja paisa",
      "price": 35000,
      "currency": "COP"
    },
    "status": "created",
    "createdAt": 1794537651674
  }
]
```

El mismo ejemplo está en [`api/orders.example.json`](api/orders.example.json). El `orders.json` real se genera al crear el primer pedido y no se versiona.

### Tests

```bash
npm test           # unitarios de orders.service.ts
npm run test:e2e   # endpoints con supertest (usa un orders.json temporal)
```

---

## 3. Comercio web (`app-comercio/`)

```bash
cd app-comercio
npm install
cp .env.example .env   # completar VITE_FIREBASE_API_KEY y VITE_FIREBASE_APP_ID
npm run dev
```

Abrir `http://localhost:5173`.

| Variable | Descripción |
|---|---|
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_DATABASE_URL`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` | Datos del `firebaseConfig` |
| `VITE_CHAT_ID` | Chat que se abre (`chat-demo-001`) |

Tests: `npm test`.

---

## 4. Cliente móvil (`app-cliente/`)

```bash
cd app-cliente
npm install
cp .env.example .env   # completar FIREBASE_API_KEY y FIREBASE_APP_ID
```

| Variable | Descripción |
|---|---|
| `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_DATABASE_URL`, `FIREBASE_PROJECT_ID`, `FIREBASE_APP_ID` | Datos del `firebaseConfig` |
| `CHAT_ID` | Chat que se abre (`chat-demo-001`) |
| `API_URL` | URL de la API. Emulador Android: `http://10.0.2.2:3000` · simulador iOS: `http://localhost:3000` · dispositivo físico: `http://<ip-local>:3000` |

**Android** (con un emulador abierto):

```bash
npm start            # Metro, en una terminal
npm run android      # en otra terminal
```

**iOS:**

```bash
bundle install
cd ios && bundle exec pod install && cd ..
npm start
npm run ios
```

Las variables se leen con `react-native-dotenv` en tiempo de compilación: después de cambiar el `.env` hay que reiniciar Metro con `npm start -- --reset-cache`.

Tests: `npm test`.

---

## Estructura

Las tres piezas siguen `src/[entidad]/[componentes]`:

```
api/src/                          app-cliente/src/                     app-comercio/src/
├── main.ts                       ├── App.tsx                          ├── App.tsx
├── app.module.ts                 ├── config/ (env, firebase)          ├── config/ (env, firebase)
└── orders/                       ├── chat/                            └── chat/
    ├── orders.module.ts          │   ├── screens/ChatScreen.tsx           ├── pages/ChatPage.tsx
    ├── controllers/              │   ├── components/                      ├── components/
    ├── services/                 │   │   ├── ProductOfferCard.tsx         │   ├── ProductOfferCard.tsx
    ├── dto/                      │   │   ├── MessageBubble.tsx            │   ├── MessageBubble.tsx
    └── interfaces/               │   │   └── MessageInput.tsx             │   ├── MessageInput.tsx
                                  │   ├── services/chat.service.ts         │   └── OfferForm.tsx
                                  │   ├── interfaces/                      ├── services/chat.service.ts
                                  │   │   └── chat-message.interface.ts    ├── interfaces/
                                  │   └── hooks/, utils/, theme/           │   └── chat-message.interface.ts
                                  └── orders/                              └── hooks/, utils/
                                      ├── services/orders.service.ts
                                      └── interfaces/order.interface.ts
```

---

## Mensajes en Firebase

Ruta: `/chats/{chatId}/messages/{messageId}`. El `id` de cada mensaje es la clave generada por `push()`. `createdAt` usa la hora del servidor de Firebase, así el orden es el mismo en las dos aplicaciones.

```jsonc
// texto (cliente o comercio)
{ "sender": "cliente", "type": "text", "text": "Hola, ¿sigue disponible?", "createdAt": 1731023940000 }

// oferta (siempre del comercio)
{
  "sender": "comercio", "type": "product_offer", "status": "pending",
  "product": { "id": "p-101", "name": "Bandeja paisa", "price": 32000, "currency": "COP", "imageUrl": "https://ejemplo.com/bandeja.jpg" },
  "createdAt": 1731024000000
}

// confirmación que publica el cliente al aprobar
{ "sender": "cliente", "type": "order_accepted", "orderId": "6d5a1d6a-…", "offerMessageId": "-Omsg1", "createdAt": 1731024100000 }
```

Estados de una oferta: `pending` → `accepted` | `rejected` | `cancelled`.

## Flujo de una oferta

1. El comercio envía la oferta (`pending`). Mientras siga pendiente puede **corregirla** (nombre, precio, moneda, imagen) o **cancelarla**.
2. El cliente ve los botones **Aprobar** y **Rechazar** solo en ofertas `pending`.
3. **Aprobar:** se verifica que la oferta siga pendiente → `POST /orders` → en una única escritura atómica se marca `accepted` y se publica el mensaje `order_accepted`. Si la API falla, la oferta no cambia y se puede reintentar.
4. **Rechazar:** se marca `rejected`, sin llamar a la API.
5. Los dos listeners reflejan el nuevo estado al instante en ambas aplicaciones.

## Reglas de Firebase

[`firebase/database.rules.json`](firebase/database.rules.json) valida en el servidor:

- La forma de cada tipo de mensaje; no se aceptan campos extra.
- Que `product_offer` solo lo envíe `comercio` y `order_accepted` solo `cliente`.
- Que `sender`, `type` y `createdAt` no cambien después de creados.
- Que `status` solo pase de `pending` a `accepted`, `rejected` o `cancelled`; una oferta respondida no se puede volver a responder.
- Que `product` solo se pueda modificar mientras la oferta está `pending`.
- Que no se puedan borrar mensajes.

## Decisiones y límites

- **Estado `cancelled`:** el enunciado define `pending`, `accepted` y `rejected`. Se agregó `cancelled` para cuando el comercio cancela una oferta pendiente, en lugar de borrarla.
- **Doble respuesta:** la impiden las reglas y además la interfaz bloquea los botones mientras se procesa la respuesta.
- **Cancelación o corrección durante una aprobación:** la escritura del cliente falla si la oferta dejó de estar `pending`, y se muestra "El comercio canceló esta oferta". Si el comercio corrigió el producto mientras tanto, la oferta aceptada queda con el producto que se guardó en el pedido.
- **Pedido sin oferta aceptada:** si el comercio cancela justo entre el `POST /orders` y la escritura en Firebase, el pedido queda guardado en la API aunque la oferta termine cancelada. Resolverlo requeriría un endpoint para anular pedidos, que no forma parte del alcance.
