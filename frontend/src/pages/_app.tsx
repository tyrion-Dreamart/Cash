import type { AppProps } from "next/app"
import Layout from "../components/Layout"
import { useRouter } from "next/router"
import { useEffect, useState } from "react"

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()
  const [auth, setAuth] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token && router.pathname !== "/login") {
      router.push("/login")
    } else {
      setAuth(true)
    }
    setChecking(false)
  }, [router.pathname])

  if (checking) return null
  if (router.pathname === "/login") return <Component {...pageProps} />
  if (!auth) return null

  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  )
}