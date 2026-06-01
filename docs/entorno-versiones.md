# Tempora — Entorno de Desarrollo

> Documento generado durante la instalación inicial del proyecto.
> Fecha: 31 de mayo de 2026

## Sistema Operativo

| Campo | Valor |
|---|---|
| OS | Windows 11 x64 |
| Usuario | Chris |
| Ruta del proyecto | `C:\Users\chris\Desktop\TEMPORA` |

## Herramientas Base

| Herramienta | Versión | Método de instalación |
|---|---|---|
| Scoop | v0.5.3 | PowerShell (usuario, sin admin) |
| Git | 2.54.0.windows.1 | `scoop install git` |
| Node.js | 24.16.0 | `scoop install nodejs-lts` |
| npm | 11.13.0 | Incluido con Node.js |
| Angular CLI | 21.2.13 | `npm install -g @angular/cli` |
| Claude Code | 2.1.158 | `npm install -g @anthropic-ai/claude-code` |
| Gentle-AI | 1.33.2 | `scoop install gentle-ai` |

## Configuración de Gentle-AI

| Parámetro | Valor |
|---|---|
| Preset | Dev Stack + Polish (full-gentleman) |
| Agente configurado | claude-code |
| Persona | gentleman |
| Strict TDD | Enabled |
| Modelos SDD | balanced (Opus para arquitectura, Sonnet para fases, Haiku para archivar) |

### Componentes instalados

| Componente | Descripción |
|---|---|
| claude-theme | Tema visual personalizado para Claude Code |
| context7 | Documentación actualizada de librerías vía MCP |
| persona | Modo mentor — explica decisiones mientras desarrolla |
| engram | Memoria persistente entre sesiones (SQLite local) |
| gga | Gentleman Guardian Angel — code review automático en cada commit |
| permissions | Seguridad por defecto — bloquea acceso a .env y secretos |
| sdd | Spec-Driven Development workflow |
| skills | Librería de skills de código curadas |

## Skills Instaladas

| Skill | Origen | Ruta |
|---|---|---|
| angular/architecture | Gentleman-Skills (curated) | `~/.claude/skills/angular/architecture/SKILL.md` |
| angular/core | Gentleman-Skills (curated) | `~/.claude/skills/angular/core/SKILL.md` |
| angular/forms | Gentleman-Skills (curated) | `~/.claude/skills/angular/forms/SKILL.md` |
| angular/performance | Gentleman-Skills (curated) | `~/.claude/skills/angular/performance/SKILL.md` |
| typescript | Gentleman-Skills (curated) | `~/.claude/skills/typescript/SKILL.md` |
| playwright | Gentleman-Skills (curated) | `~/.claude/skills/playwright/SKILL.md` |

## Stack del Proyecto (detectado por SDD)

| Capa | Tecnología | Versión |
|---|---|---|
| Frontend | Angular | 21 |
| Frontend | TypeScript | 5.9 (strict) |
| Frontend | Testing | Vitest 4.0 + TestBed |
| Frontend | Estilos | SCSS |
| Frontend | Patrones | Signals, OnPush obligatorio |
| Backend | Node.js | 24.16.0 |
| Backend | Express | 5.2 |
| Backend | TypeScript | 6.0 |
| Backend | Dev server | ts-node + nodemon |

## Estado del Ecosistema

| Componente | Estado | Nota |
|---|---|---|
| gentle-ai | ✅ OK | v1.33.2 |
| claude-code | ✅ OK | v2.1.158, autenticado |
| SDD | ✅ Inicializado | 17 skills registradas |
| TDD | ✅ Activo | Strict TDD en frontend |
| Engram | ⚠️ Parcial | MCP no disponible en Windows en esta sesión. Los sub-agentes detectan contexto desde el código. |
| GGA | ⏳ Pendiente | Ejecutar `gga init` y `gga install` dentro de `/TEMPORA` |

## Pendiente

```bash
# Activar GGA (Guardian Angel) en el proyecto
cd C:\Users\chris\Desktop\TEMPORA
gga init
gga install
```

## Notas

- Scoop instalado en modo usuario (sin privilegios de administrador).
- Git configurado con identidad global.
- Angular fue configurado con integración Claude durante `ng new`.
- El skill registry se construyó automáticamente al abrir Claude Code (17 skills).
- Artifact store configurado en modo `openspec` para esta sesión.
