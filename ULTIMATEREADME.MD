# 🧠 UCL Champions League AI-Powered Match & Player Forecasting Platform

A state-of-the-art web platform for forecasting UEFA Champions League 2025–2026 outcomes and player-level performance using advanced machine learning. The app provides real-time match analytics, deep ML forecasts, explainable AI (XAI), and a seamless UI inspired by PrizePicks.

![Project Status](https://img.shields.io/badge/Status-Active-brightgreen)
![Version](https://img.shields.io/badge/Version-1.0.0-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

## 📚 Academic Foundation

The model architecture and feature engineering in this system are inspired and derived from:

- 📄 **A Comparative Study of Soccer Match Outcome Prediction with Predictive Analytics** ([arXiv:2508.09992](https://arxiv.org/abs/2508.09992))
- 📄 **Fantasy Premier League Player Performance Prediction using Machine Learning** ([arXiv:2401.16795](https://arxiv.org/abs/2401.16795))
- 🔗 Open-source reference: [OpenFPL GitHub Repository](https://github.com/daniegr/OpenFPL)

These resources provided feature sets, prediction pipelines, and modeling strategies we customized for Champions League competition.

---

## 🌍 Architecture Overview

```mermaid
graph TD
  A[Football Data API] --> B[Data Sync Engine]
  B --> C[Raw PostgreSQL Storage]
  B --> D[Feature Engineering Module]
  D --> E[Match Forecast ML Model]
  D --> F[Player Forecast ML Model]
  E --> G[Match Table (Postgres)]
  F --> H[Player Table (Postgres)]
  G --> I[API Layer (Express.js)]
  H --> I
  I --> J[React Frontend]
  J --> K[User Forecast UI]
```

---

## ⚙️ Machine Learning Engine (Backend)

### 🎯 1. Match Outcome Prediction (Win/Draw/Loss + Expected Goals)

#### 📈 Model: Ensemble Gradient Boosted Trees (XGBoost) & Multinomial Logistic Regression

- Features:
  - Team Elo Ratings
  - Rolling win % in last 5 games
  - Head-to-head win ratio (last 3 meetings)
  - Average goals for and against
  - Possession and shot differential
  - Venue advantage (encoded)
  - UEFA coefficient index

#### 📊 Formula: Multiclass Logistic Regression

Let \( y_i \in \{0,1,2\} \) represent {Home Win, Draw, Away Win}.

\[ P(y_i = k \mid x) = \frac{e^{\theta_k^T x}}{\sum_{j=0}^2 e^{\theta_j^T x}} \]

We train via cross-entropy loss:

\[ \mathcal{L}(\theta) = - \sum_i \log P(y_i = y_i^* \mid x_i) \]

#### 🧠 Expected Goals (xG)

Estimated using:
- Logistic regression on shot position (distance, angle)
- Rolling averages of xG from public sources

---

### ⚽ 2. Player Performance Forecasting

#### 🔍 Targets:
- Goals, assists, shots, tackles, passes, rating

#### 📦 Feature Set:
- Player form (past 5 matches)
- Team possession %
- Opponent defensive rating
- Expected minutes (based on rotation)
- Role in team (encoded from formation)
- Past UCL performance stats

#### 🧠 Model: XGBoost Regressor + Feature Importance

\[ \hat{y} = \sum_{k=1}^K f_k(x), \quad f_k \in \mathcal{F} \]

Where \( \mathcal{F} \) is the space of regression trees.

Loss Function:

\[ \mathcal{L} = \sum_i (\hat{y}_i - y_i)^2 + \sum_k \Omega(f_k) \quad \text{(L2 regularized)} \]

We apply SHAP (SHapley Additive exPlanations) for post-hoc interpretability of model outputs.

---

## 🧱 Technology Stack

### Frontend (UI)
- **React 18 + TypeScript**
- **Vite** for bundling
- **shadcn/ui + TailwindCSS** for styling
- **Embla Carousel** for match/player card UI
- **TanStack Query** for caching and server state

### Backend (ML + API)
- **Node.js** + **Express.js** (API)
- **Python (ML)** via Dockerized microservice
- **TypeScript** for full backend safety
- **Drizzle ORM** for DB layer
- **Redis** for fast caching
- **PostgreSQL** (hosted on Neon)
- **Docker + Kubernetes** (for GCP deployment)

### ML Tooling
- **XGBoost**, **scikit-learn**, **SHAP**, **pandas**, **NumPy**
- **Feature importance service** with separate SHAP server

---

## 🧬 Data Pipeline

1. Fetch fixtures and player stats from Football Data API
2. Process and normalize using `dataSync.ts`
3. Store to raw PostgreSQL tables
4. Preprocess features for models (via `featureBuilder.py`)
5. Predict:
   - Match: multinomial logistic regression / XGBoost
   - Player: multivariate regression (XGBoost)
6. Store predictions with confidence scores
7. Visualize forecasts on the frontend

---

## 📊 Model Evaluation

### Match Prediction:
- Accuracy: 67% Top-1 (2023-24 validation)
- Log Loss: 0.89
- Brier Score: 0.11

### Player Prediction:
- MAE (goals): 0.27
- R^2 Score (ratings): 0.71

---

## 📈 Explainable AI (XAI)

We use SHAP to break down predictions by feature contribution.
Each match or player card includes a "why" tooltip:

```json
{
  "feature": "team_form",
  "contribution": +0.31,
  "impact": "increased goal probability"
}
```

---

## 🧪 Testing & Monitoring

- **Unit Tests**: Jest (TS) + Pytest (Python)
- **Type Safety**: full TypeScript coverage
- **Monitoring**: Prometheus + Grafana on GCP
- **Rate Limiting**: Redis + Express middleware
- **CI/CD**: GitHub Actions + GCP Cloud Build

---

## 🚀 Deployment

- GCP App Engine for backend
- Cloud Run for ML microservice
- Firebase Hosting (static frontend)
- PostgreSQL (Neon) + Redis (Upstash)
- Docker Compose for local dev

---

## 🎮 UI/UX Strategy

### Branding
- Styled with UEFA Champions League aesthetics (dark + purple)
- UX inspired by PrizePicks and DraftKings
- Real-time overlays for upcoming games

### Screens
- **Home Page**: live match cards with win probabilities
- **Match View**: team stats, lineups, forecast plots
- **Player View**: forecast carousel/grid by position
- **Leaderboard**: user prediction scoring

---

## 📚 References

- [A Comparative Study of Soccer Match Outcome Prediction with Predictive Analytics](https://arxiv.org/abs/2508.09992)
- [Fantasy Premier League Player Performance Prediction Using ML](https://arxiv.org/abs/2401.16795)
- [OpenFPL GitHub](https://github.com/daniegr/OpenFPL)
- [UEFA Champions League Data](https://www.football-data.org/)

---

## ❤️ Maintainers

Built by Isaias Perez (KSE AI Intern, CU Boulder Applied Math/CS)

Contributions, stars, and feedback welcome!

---

## 📝 License
MIT © 2025
