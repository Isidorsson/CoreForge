//go:build !windows

package process

import (
	"bufio"
	"fmt"
	"os"
	"os/signal"
)

// runCLIHelper is the pipe-based stand-in for the Windows console helper.
func runCLIHelper() {
	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt)
	go func() {
		<-interrupt
		fmt.Println("shutting down cleanly")
		os.Exit(0)
	}()
	fmt.Println("world initialized")
	sc := bufio.NewScanner(os.Stdin)
	for sc.Scan() {
		fmt.Printf("TC> reply to %s\n", sc.Text())
	}
	select {}
}
