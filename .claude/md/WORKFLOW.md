# HealthPanel - Flujo de Trabajo con Agentes

## Secuencia de ejecución automática

```
FASE 1 (9 subtareas) ─── Sonnet 4.6 (1.1→1.9) ─── Opus 4.6 (revisión) ─── ✓
   │
FASE 2 (5 subtareas) ─── Sonnet 4.6 (2.1→2.5) ─── Opus 4.6 (revisión) ─── ✓
   │
FASE 3 (5 subtareas) ─── Sonnet 4.6 (3.1→3.5) ─── Opus 4.6 (revisión) ─── ✓
   │
FASE 4 (6 subtareas) ─── Sonnet 4.6 (4.1→4.6) ─── Opus 4.6 (revisión) ─── ✓
   │
FASE 5 (4 subtareas) ─── Sonnet 4.6 (5.1→5.4) ─── Opus 4.6 (revisión) ─── ✓
   │
FASE 6 (4 subtareas) ─── Sonnet 4.6 (6.1→6.4) ─── Opus 4.6 (revisión) ─── ✓
   │
FASE 7 (4 subtareas) ─── Sonnet 4.6 (7.1→7.4) ─── Opus 4.6 (revisión) ─── ✓
```

## Instrucciones para Sonnet 4.6 (desarrollo de subtareas)

```
1. Leer .claude/md/PLAN.md completo
2. Identificar la fase y subtarea actual
3. Desarrollar el código de la subtarea
4. Verificar que compila sin errores (npm run build / tsc)
5. La última subtarea de cada fase SIEMPRE es tests + seguridad
6. Al terminar TODAS las subtareas de la fase → señalar listo para revisión
```

## Instrucciones para Opus 4.6 (revisión de fase)

```
1. Leer .claude/md/PLAN.md → criterios de aceptación de la fase
2. Revisar TODO el código generado en la fase
3. Checklist de verificación:
   ✓ No hay alucinaciones (imports inexistentes, APIs inventadas)
   ✓ El código compila y es funcional
   ✓ Se cumplen TODOS los criterios de aceptación
   ✓ Coherencia con la arquitectura del monorepo
   ✓ TypeORM: synchronize=false, migraciones correctas
   ✓ Puertos configurables desde .env
   ✓ Hot reload funciona en Docker dev
   ✓ No hay vulnerabilidades de seguridad (OWASP)
   ✓ No hay secrets hardcodeados
   ✓ Tests existen y son válidos
4. Si hay problemas → listar correcciones → modificar TODO si es necesario → Sonnet corrige
5. Si todo OK → certificar → avanzar a siguiente fase
```

## Notas importantes

- Cada subtarea de tests incluye verificación de seguridad
- TypeORM NUNCA usa synchronize: true
- Migraciones y seeders se ejecutan manualmente, no automático
- Los puertos PORT_PANEL, PORT_API, PORT_DB son configurables
- PostgreSQL usa volumen Docker para persistencia
- Hot reload activo en desarrollo via volume mounts
- Node.js LTS, Next.js LTS, NestJS LTS
