package main

import "CoreForge/internal/process"

// Server + DB controls. These delegate to the process manager; errors surface to
// the frontend as rejected promises.

func (a *App) StartDB() error { return a.Process.StartDB() }
func (a *App) StopDB() error  { return a.Process.StopDB() }

func (a *App) StartAuth() error  { return a.Process.StartAuth() }
func (a *App) StartWorld() error { return a.Process.StartWorld() }
func (a *App) StartAll() error   { return a.Process.StartAll() }

func (a *App) StopAuth(force bool) error  { return a.Process.StopAuth(force) }
func (a *App) StopWorld(force bool) error { return a.Process.StopWorld(force) }
func (a *App) StopAll(force bool) error   { return a.Process.StopAll(force) }

func (a *App) RestartServer(target string) error    { return a.Process.Restart(target) }
func (a *App) SendConsole(target, cmd string) error { return a.Process.SendConsole(target, cmd) }

func (a *App) GetStatus() process.Status          { return a.Process.GetStatus() }
func (a *App) GetBacklog(target string) []string  { return a.Process.Backlog(target) }
