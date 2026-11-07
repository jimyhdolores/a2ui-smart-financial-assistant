"""Datos y matemática financiera del agente (port fiel del front Angular)."""

from .analytics import FINANCE_COMPONENTS, FinanceAnalytics
from .data import Dataset, build_dataset

__all__ = ["FINANCE_COMPONENTS", "Dataset", "FinanceAnalytics", "build_dataset"]
