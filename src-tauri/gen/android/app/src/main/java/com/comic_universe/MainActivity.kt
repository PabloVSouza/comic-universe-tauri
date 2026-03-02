package com.comic_universe

import android.graphics.Color
import android.os.Bundle
import androidx.core.view.WindowCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    WindowCompat.setDecorFitsSystemWindows(window, true)
    window.statusBarColor = Color.BLACK
    window.navigationBarColor = Color.BLACK
  }
}
